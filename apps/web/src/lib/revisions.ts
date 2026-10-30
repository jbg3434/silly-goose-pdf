import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { pool } from "./db";

const run = promisify(execFile);
export const STORAGE_ROOT = path.resolve(process.cwd(), process.env.ARTIFACT_ROOT ?? "../../storage");
const GENERATOR = path.resolve(process.cwd(), "../../generator");

export const ROLES = ["editor", "reviewer", "compliance", "publisher"] as const;
export type Role = (typeof ROLES)[number];

// Simulated review gates: which role may move a revision from one state to the next.
export const TRANSITIONS: Record<string, Partial<Record<string, Role>>> = {
  draft: { internal_review: "editor", withdrawn: "editor" },
  internal_review: { ready_for_filing: "reviewer", rejected: "reviewer" },
  ready_for_filing: { submitted: "compliance", withdrawn: "compliance" },
  submitted: { approved: "compliance", rejected: "compliance" },
};

export class WorkflowError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

async function worker(args: string[]) {
  const { stdout } = await run("python3", ["-m", "sgm.revision", ...args], { cwd: GENERATOR, maxBuffer: 64 << 20, timeout: 300_000 });
  return JSON.parse(stdout);
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const rel = (abs: string) => path.relative(STORAGE_ROOT, abs);

async function registerArtifact(
  client: { query: typeof pool.query },
  file: string,
  role: string,
  format: string,
  lineageId: string,
  actor: string,
  parent: string | null,
) {
  const bytes = await readFile(file);
  const hash = sha256(bytes);
  const id = `ART-${role.toUpperCase()}-${hash.slice(0, 16)}`;
  await client.query(
    `INSERT INTO artifacts (artifact_id, edition_id, lineage_id, parent_artifact_id, role, format, path, sha256, byte_size, uploaded_by, renderer_version, immutable)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE) ON CONFLICT (artifact_id) DO NOTHING`,
    [id, lineageId, parent, role, format, rel(file), hash, bytes.length, actor, format === "pdf" ? "libreoffice-7.3" : null],
  );
  return { id, hash };
}

async function baseExtract(documentId: string, productId: string, odtPath: string) {
  const cache = path.join(STORAGE_ROOT, "revisions", "_base", `${documentId}.json`);
  try {
    return JSON.parse(await readFile(cache, "utf8"));
  } catch {
    const ex = await worker(["extract", odtPath, productId]);
    await mkdir(path.dirname(cache), { recursive: true });
    await writeFile(cache, JSON.stringify(ex));
    return ex;
  }
}

export async function createRevision(lineageId: string, filename: string, bytes: Buffer, actor: string, requestId: string) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (ext !== "odt" && ext !== "docx") throw new WorkflowError("unsupported_format", "Upload an ODT or DOCX file.");
  if (bytes.length > 20 << 20) throw new WorkflowError("too_large", "Uploads are limited to 20 MB.");
  const base = (
    await pool.query<{ document_id: string; product_id: string; edition_number: number; odt_path: string | null }>(
      `SELECT d.document_id, d.product_id, e.edition_number,
              (SELECT a.path FROM artifacts a WHERE a.edition_id = e.edition_id AND a.format = 'odt' ORDER BY a.uploaded_at DESC LIMIT 1) AS odt_path
       FROM editions e JOIN documents d ON d.edition_id = e.edition_id
       WHERE e.lineage_id = $1 AND e.publication_state = 'published' AND e.current_to IS NULL`,
      [lineageId],
    )
  ).rows[0];
  if (!base) throw new WorkflowError("lineage_not_found", "No current published edition for this lineage.", 404);
  if (!base.odt_path) throw new WorkflowError("no_editable_source", "The current edition has no editable ODT source.");

  const hash = sha256(bytes);
  const uploadPath = path.join(STORAGE_ROOT, "uploads", `${hash}.${ext}`);
  await mkdir(path.dirname(uploadPath), { recursive: true });
  try {
    await stat(uploadPath);
  } catch {
    await writeFile(uploadPath, bytes, { flag: "wx" });
  }
  const revisionId = `REV-${lineageId}-${Date.now().toString(36)}`;
  const work = path.join(STORAGE_ROOT, "revisions", revisionId);
  await mkdir(work, { recursive: true });
  const src = path.join(work, `${revisionId}.${ext}`);
  await copyFile(uploadPath, src);
  const out = await worker(["ingest", src, base.product_id, work]);

  const parent = (
    await pool.query<{ revision_id: string; extracted: unknown }>(
      "SELECT revision_id, extracted FROM revisions WHERE lineage_id = $1 ORDER BY created_at DESC LIMIT 1",
      [lineageId],
    )
  ).rows[0];
  const reference = parent?.extracted ?? (await baseExtract(base.document_id, base.product_id, path.join(STORAGE_ROOT, base.odt_path)));
  const refFile = path.join(work, "reference.json");
  const newFile = path.join(work, "extract.json");
  await writeFile(refFile, JSON.stringify(reference));
  await writeFile(newFile, JSON.stringify(out.extract));
  const diff = await worker(["diff", refFile, newFile]);
  const basePdf = (
    await pool.query<{ path: string }>(
      "SELECT a.path FROM documents d JOIN artifacts a ON a.artifact_id = d.published_pdf_artifact_id WHERE d.document_id = $1",
      [base.document_id],
    )
  ).rows[0];
  diff.visual = await worker(["visual", path.join(STORAGE_ROOT, basePdf.path), out.pdf, path.join(work, "visual")]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const source = await registerArtifact(client, uploadPath, "draft-upload", ext, lineageId, actor, null);
    const odt = ext === "odt" ? source : await registerArtifact(client, out.odt, "draft-odt", "odt", lineageId, actor, source.id);
    const pdf = await registerArtifact(client, out.pdf, "draft-pdf", "pdf", lineageId, actor, odt.id);
    await client.query(
      `INSERT INTO revisions (revision_id, lineage_id, target_edition, parent_revision_id, base_document_id, source_artifact_id,
         canonical_odt_artifact_id, pdf_artifact_id, source_format, created_by, conversion_report, extracted, diff)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [revisionId, lineageId, base.edition_number + 1, parent?.revision_id ?? null, base.document_id, source.id, odt.id, pdf.id, ext, actor,
        JSON.stringify(out.report), JSON.stringify(out.extract), JSON.stringify(diff)],
    );
    await client.query(
      `INSERT INTO approval_events (revision_id, stage, actor, role, notes, artifact_sha256) VALUES ($1,'draft',$2,'editor',$3,$4)`,
      [revisionId, actor, `Uploaded ${filename}`, odt.hash],
    );
    await client.query(
      "INSERT INTO audit_events (actor, role, action, target, request_id, details) VALUES ($1,'editor','upload',$2,$3,$4)",
      [actor, revisionId, requestId, JSON.stringify({ filename, sha256: hash })],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return revisionId;
}

export async function transition(revisionId: string, to: string, role: Role, actor: string, notes: string | null, requestId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = (
      await client.query<{ status: string; lineage_id: string; odt_sha: string; approved_sha256: string | null; state: string }>(
        `SELECT r.status, r.lineage_id, a.sha256 AS odt_sha, r.approved_sha256, l.state
         FROM revisions r JOIN artifacts a ON a.artifact_id = r.canonical_odt_artifact_id JOIN lineages l ON l.lineage_id = r.lineage_id
         WHERE r.revision_id = $1 FOR UPDATE OF r`,
        [revisionId],
      )
    ).rows[0];
    if (!r) throw new WorkflowError("revision_not_found", "Revision not found.", 404);
    const newer = await client.query("SELECT 1 FROM revisions WHERE parent_revision_id = $1", [revisionId]);
    if (newer.rowCount && to !== "withdrawn") {
      throw new WorkflowError("superseded_revision", "A newer revision was uploaded; review restarts on that revision.", 409);
    }
    const needed = TRANSITIONS[r.status]?.[to];
    if (!needed) throw new WorkflowError("invalid_transition", `Cannot move from ${r.status} to ${to}.`, 409);
    if (needed !== role) throw new WorkflowError("forbidden_role", `Only the ${needed} role can move a revision to ${to}.`, 403);
    const receipt = to === "approved" ? `SIM-DOI-${r.state}-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}` : null;
    await client.query("UPDATE revisions SET status = $2, approved_sha256 = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_sha256 END WHERE revision_id = $1", [
      revisionId, to, r.odt_sha,
    ]);
    await client.query(
      `INSERT INTO approval_events (revision_id, stage, actor, role, notes, artifact_sha256, simulated_receipt_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [revisionId, to, actor, role, notes ?? (to === "submitted" || to === "approved" ? "Simulated DOI workflow. No real filing was made." : null), r.odt_sha, receipt],
    );
    await client.query("INSERT INTO audit_events (actor, role, action, target, request_id, details) VALUES ($1,$2,$3,$4,$5,$6)", [
      actor, role, `transition:${to}`, revisionId, requestId, JSON.stringify({ from: r.status, sha256: r.odt_sha }),
    ]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Publishes an approved revision as the lineage's new current edition. Only the exact approved ODT bytes may be published.
export async function publish(revisionId: string, role: Role, actor: string, requestId: string) {
  if (role !== "publisher") throw new WorkflowError("forbidden_role", "Only the publisher role can publish.", 403);
  const r = (
    await pool.query<{ status: string; lineage_id: string; target_edition: number; approved_sha256: string | null; odt_id: string; odt_path: string; odt_sha: string; pdf_id: string; product_id: string; state: string }>(
      `SELECT r.status, r.lineage_id, r.target_edition, r.approved_sha256, a.artifact_id AS odt_id, a.path AS odt_path, a.sha256 AS odt_sha,
              r.pdf_artifact_id AS pdf_id, l.product_id, l.state
       FROM revisions r JOIN artifacts a ON a.artifact_id = r.canonical_odt_artifact_id JOIN lineages l ON l.lineage_id = r.lineage_id
       WHERE r.revision_id = $1`,
      [revisionId],
    )
  ).rows[0];
  if (!r) throw new WorkflowError("revision_not_found", "Revision not found.", 404);
  if (r.status !== "approved") throw new WorkflowError("not_approved", "Only an approved revision can be published.", 409);
  const bytes = await readFile(path.join(STORAGE_ROOT, r.odt_path));
  if (sha256(bytes) !== r.approved_sha256 || r.odt_sha !== r.approved_sha256) {
    throw new WorkflowError("approval_hash_mismatch", "The source no longer matches the approved artifact hash.", 409);
  }
  const work = path.join(STORAGE_ROOT, "revisions", revisionId);
  await run("soffice", [`-env:UserInstallation=file:///tmp/sgm-lo-publish`, "--headless", "--convert-to", "docx:MS Word 2007 XML", "--outdir", work,
    path.join(STORAGE_ROOT, r.odt_path)], { timeout: 300_000 });
  const docxFile = path.join(work, `${path.basename(r.odt_path, ".odt")}.docx`);
  const editionId = `${r.lineage_id}-E${r.target_edition}`;
  const documentId = `SGM-${editionId}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prev = (
      await client.query<{ edition_id: string }>(
        "SELECT edition_id FROM editions WHERE lineage_id = $1 AND publication_state = 'published' AND current_to IS NULL FOR UPDATE",
        [r.lineage_id],
      )
    ).rows[0];
    const exists = await client.query("SELECT 1 FROM editions WHERE edition_id = $1", [editionId]);
    if (exists.rowCount) throw new WorkflowError("edition_exists", `${editionId} already exists.`, 409);
    if (prev) {
      await client.query("UPDATE editions SET publication_state = 'superseded', current_to = now() WHERE edition_id = $1", [prev.edition_id]);
    }
    const pages = (await client.query<{ n: number }>("SELECT page_count AS n FROM documents WHERE edition_id = $1", [prev?.edition_id])).rows[0]?.n ?? null;
    await client.query(
      `INSERT INTO editions (edition_id, lineage_id, parent_edition_id, edition_number, effective_date, revision, source_format,
         approval_state, publication_state, current_from, change_summary)
       VALUES ($1,$2,$3,$4,current_date,$5,'odt','approved','published',now(),$6)`,
      [editionId, r.lineage_id, prev?.edition_id ?? null, r.target_edition, `${r.target_edition}.0`, `Published from ${revisionId}`],
    );
    const docx = await registerArtifact(client, docxFile, "export-docx", "docx", r.lineage_id, actor, r.odt_id);
    await client.query("UPDATE artifacts SET edition_id = $1 WHERE artifact_id = ANY($2)", [editionId, [r.odt_id, r.pdf_id, docx.id]]);
    await client.query(
      `INSERT INTO documents (document_id, product_id, state, edition_id, published_pdf_artifact_id, page_count, generator_version)
       VALUES ($1,$2,$3,$4,$5,$6,'revision-upload')`,
      [documentId, r.product_id, r.state, editionId, r.pdf_id, pages],
    );
    await client.query("INSERT INTO index_status (document_id, artifact_sha256, state) SELECT $1, sha256, 'queued' FROM artifacts WHERE artifact_id = $2", [documentId, r.pdf_id]);
    await client.query("UPDATE revisions SET published_edition_id = $2 WHERE revision_id = $1", [revisionId, editionId]);
    await client.query(
      "INSERT INTO approval_events (revision_id, edition_id, stage, actor, role, notes, artifact_sha256) VALUES ($1,$2,'published',$3,'publisher',$4,$5)",
      [revisionId, editionId, actor, "Publication snapshot: approved ODT, DOCX export, and PDF share this revision.", r.odt_sha],
    );
    await client.query("INSERT INTO audit_events (actor, role, action, target, request_id, details) VALUES ($1,'publisher','publish',$2,$3,$4)", [
      actor, revisionId, requestId, JSON.stringify({ edition_id: editionId }),
    ]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return documentId;
}
