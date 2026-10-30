// Idempotent corpus indexer: extract/OCR/chunk via the Python worker, embed, and load chunks.
// A document is re-indexed only when its published PDF hash or any pipeline version changed (or --force).
import { spawn, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pool } from "../src/lib/db";
import { EMBEDDING_ID, embed, toVector } from "../src/lib/embed";

const GENERATOR = path.resolve(__dirname, "../../../generator");
const PYTHON = process.env.SGM_PYTHON ?? "python3";
const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.find((a) => a.startsWith("--docs="))?.slice(7).split(",");
const BATCH = 48;

type Doc = {
  document_id: string; product_id: string; state: string; edition_id: string; edition_number: number;
  family: string; state_name: string; path: string | null; sha256: string | null;
};
type Result = {
  document_id: string; ok: boolean; error?: string; chunks_path?: string; ocr_pages?: number[];
  min_ocr_confidence?: number | null; flags?: unknown[]; chunks?: number;
};
type Chunk = {
  chunk_id: string; kind: string; section_id: string; section_title: string; page_start: number; page_end: number;
  bbox: unknown; confidence: number; artifact_sha256: string; text: string; fact_ids: string[];
};

const versions = JSON.parse(
  execFileSync(PYTHON, ["-c", "import json;from sgm.ingest import EXTRACTION_VERSION as e,CHUNKING_VERSION as c;print(json.dumps([e,c]))"], { cwd: GENERATOR }).toString(),
) as [string, string];

function runWorker(jobs: object[]): Promise<Result[]> {
  return new Promise((resolve, reject) => {
    const p = spawn(PYTHON, ["-m", "sgm.ingest", "8"], { cwd: GENERATOR });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) =>
      code === 0 ? resolve(out.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))) : reject(new Error(err.slice(-2000))),
    );
    p.stdin.end(JSON.stringify(jobs));
  });
}

const heading = (doc: Doc, c: Chunk) =>
  `${doc.family} — ${doc.state_name} (${doc.state}) — Edition ${doc.edition_number} — ${c.section_title}`;

// Sorting by length keeps padding small, which is most of the CPU cost of batched embedding.
async function embedAll(texts: string[]) {
  const order = texts.map((t, i) => [t.length, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  const out: number[][] = new Array(texts.length);
  for (let i = 0; i < order.length; i += 16) {
    const ids = order.slice(i, i + 16);
    (await embed(ids.map((j) => texts[j]))).forEach((v, n) => (out[ids[n]] = v));
  }
  return out;
}

async function load(doc: Doc, r: Result, chunks: Chunk[], vectors: number[][]) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM chunks WHERE document_id = $1", [doc.document_id]);
    await client.query(
      `INSERT INTO chunks (chunk_id, document_id, edition_id, product_id, state, section_id, section_title, page_start, page_end,
         fact_ids, artifact_sha256, text, embedding, is_current, heading, kind, bbox, confidence, edition_number)
       SELECT x.chunk_id, $1, e.edition_id, $3, $4, x.section_id, x.section_title, x.page_start, x.page_end,
         ARRAY(SELECT jsonb_array_elements_text(x.fact_ids)), x.artifact_sha256, x.text, x.embedding::vector,
         (e.publication_state = 'published' AND e.current_to IS NULL), x.heading, x.kind, x.bbox, x.confidence, e.edition_number
       FROM jsonb_to_recordset($5::jsonb) AS x(chunk_id text, section_id text, section_title text, page_start int, page_end int,
         fact_ids jsonb, artifact_sha256 text, text text, embedding text, heading text, kind text, bbox jsonb, confidence real)
       JOIN editions e ON e.edition_id = $2`,
      [doc.document_id, doc.edition_id, doc.product_id, doc.state,
        JSON.stringify(chunks.map((c, i) => ({ ...c, embedding: toVector(vectors[i]), heading: heading(doc, c) })))],
    );
    await client.query(
      `UPDATE index_status SET state = 'indexed', artifact_sha256 = $2, extraction_version = $3, chunking_version = $4,
         embedding_model = $5, chunk_count = $6, ocr_pages = $7, min_ocr_confidence = $8, flags = $9, error = NULL, updated_at = now()
       WHERE document_id = $1`,
      [doc.document_id, doc.sha256, versions[0], versions[1], EMBEDDING_ID, chunks.length, r.ocr_pages ?? [],
        r.min_ocr_confidence ?? null, JSON.stringify(r.flags ?? [])],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function fail(id: string, error: string) {
  await pool.query("UPDATE index_status SET state = 'failed', error = $2, updated_at = now() WHERE document_id = $1", [id, error]);
}

async function main() {
  await pool.query("INSERT INTO index_status (document_id) SELECT document_id FROM documents ON CONFLICT DO NOTHING");
  const { rows } = await pool.query<Doc>(
    `SELECT d.document_id, d.product_id, d.state, d.edition_id, e.edition_number, p.family, s.name AS state_name, a.path, a.sha256
     FROM documents d JOIN editions e USING (edition_id) JOIN products p ON p.id = d.product_id JOIN states s ON s.code = d.state
     LEFT JOIN artifacts a ON a.artifact_id = d.published_pdf_artifact_id
     JOIN index_status i USING (document_id)
     WHERE ($1 OR i.state <> 'indexed' OR i.artifact_sha256 IS DISTINCT FROM a.sha256 OR i.extraction_version IS DISTINCT FROM $2
            OR i.chunking_version IS DISTINCT FROM $3 OR i.embedding_model IS DISTINCT FROM $4)
       AND ($5::text[] IS NULL OR d.document_id = ANY($5))
     ORDER BY d.document_id`,
    [force, versions[0], versions[1], EMBEDDING_ID, only ?? null],
  );
  console.log(`${rows.length} documents need indexing (${versions.join(", ")}, ${EMBEDDING_ID})`);
  await pool.query("UPDATE index_status SET state = 'queued', updated_at = now() WHERE document_id = ANY($1)", [rows.map((r) => r.document_id)]);
  let done = 0, failed = 0;
  const t0 = Date.now();
  const batches: Doc[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));
  const extract = async (batch: Doc[]) => {
    const ready = batch.filter((d) => d.path);
    await pool.query("UPDATE index_status SET state = 'processing', updated_at = now() WHERE document_id = ANY($1)", [ready.map((d) => d.document_id)]);
    return runWorker(ready.map((d) => ({ document_id: d.document_id, product_id: d.product_id, pdf_path: d.path, sha256: d.sha256 })));
  };
  // Extract the next batch in Python while this one is embedded in Node.
  let next = batches.length ? extract(batches[0]) : null;
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const results = await next!;
    next = b + 1 < batches.length ? extract(batches[b + 1]) : null;
    for (const d of batch.filter((d) => !d.path)) {
      await fail(d.document_id, "No published PDF artifact");
      failed++;
    }
    const byId = new Map(results.map((r) => [r.document_id, r]));
    const loaded: { doc: Doc; r: Result; chunks: Chunk[] }[] = [];
    for (const d of batch.filter((d) => d.path)) {
      const r = byId.get(d.document_id);
      if (!r?.ok) {
        await fail(d.document_id, r?.error ?? "worker returned no result");
        failed++;
        continue;
      }
      const chunks: Chunk[] = readFileSync(r.chunks_path!, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      loaded.push({ doc: d, r, chunks });
    }
    const vectors = await embedAll(loaded.flatMap(({ doc, chunks }) => chunks.map((c) => `${heading(doc, c)}\n${c.text}`)));
    let offset = 0;
    for (const { doc, r, chunks } of loaded) {
      try {
        await load(doc, r, chunks, vectors.slice(offset, offset + chunks.length));
        done++;
      } catch (e) {
        await fail(doc.document_id, String(e instanceof Error ? e.message : e).slice(0, 1000));
        failed++;
      }
      offset += chunks.length;
    }
    console.log(`indexed ${done}, failed ${failed} of ${rows.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  await pool.query(
    `UPDATE chunks c SET is_current = (e.publication_state = 'published' AND e.current_to IS NULL)
     FROM editions e WHERE e.edition_id = c.edition_id`,
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
