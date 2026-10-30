import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { pool } from "../src/lib/db";

// Loads a corpus build (storage/corpus) into Postgres: canonical facts and overrides, immutable artifacts,
// per-document metadata, evidence spans, and a simulated approval trail. Safe to re-run.
const corpusDir = path.resolve(__dirname, "../../../storage/corpus");

type Artifact = {
  artifact_id: string; role: string; format: string; path: string; sha256: string; byte_size: number;
  parent_artifact_id: string | null; renderer_version: string | null; uploaded_by: string;
};
type ManifestDoc = {
  document_id: string; edition: number; edition_id: string; state: string; page_count: number; image_only_pages: number[];
  published_pdf_artifact_id: string; artifacts: Artifact[]; change_summary: string | null; generator_version: string;
};

const SIM = "Simulated DOI workflow";

async function main() {
  if (!existsSync(path.join(corpusDir, "manifest.json"))) {
    throw new Error(`No corpus build at ${corpusDir}. Run \`pnpm corpus:build\` first.`);
  }
  const manifest = JSON.parse(readFileSync(path.join(corpusDir, "manifest.json"), "utf8"));
  const canonical = JSON.parse(readFileSync(path.join(corpusDir, "canonical.json"), "utf8"));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM evidence_spans");
    await client.query("DELETE FROM approval_events");
    await client.query("UPDATE documents SET published_pdf_artifact_id = NULL");
    await client.query("DELETE FROM index_status");
    await client.query("DELETE FROM artifacts");
    await client.query("DELETE FROM overrides");
    await client.query("DELETE FROM facts");
    await client.query("DELETE FROM sections");
    await client.query("DELETE FROM synthetic_regulations");

    for (const [state, rules] of Object.entries(canonical.regulations.states as Record<string, Array<Record<string, string>>>)) {
      for (const r of rules) {
        await client.query(
          "INSERT INTO synthetic_regulations (rule_id, state, category, title, authority) VALUES ($1,$2,$3,$4,$5)",
          [r.rule_id, state, r.category, r.title, r.authority],
        );
      }
    }
    for (const s of canonical.sections) {
      await client.query("INSERT INTO sections (product_id, section_id, number, title, sort_order) VALUES ($1,$2,$3,$4,$5)", [
        s.product_id, s.section_id, s.number, s.title, s.sort_order,
      ]);
    }
    for (const f of canonical.facts) {
      await client.query(
        `INSERT INTO facts (fact_id, product_id, section_id, topic, statement_template, value, unit, conditions, footnotes,
           related_fact_ids, introduced_edition, in_table, alternatives)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [f.fact_id, f.product_id, f.section_id, f.topic, f.statement_template, f.value, f.unit, JSON.stringify(f.conditions),
          JSON.stringify(f.footnotes), f.related_fact_ids, f.introduced_edition, f.in_table, JSON.stringify(f.alternatives)],
      );
    }
    const category = (sectionId: string) =>
      ({ billing: "notice", claims: "claims", eligibility: "eligibility", waiting: "catastrophe", deductibles: "catastrophe" })[
        sectionId
      ] ?? "coverage";
    const factSection = new Map<string, string>(canonical.facts.map((f: { fact_id: string; section_id: string }) => [f.fact_id, f.section_id]));
    for (const o of canonical.overrides) {
      const rule = o.reason_code === "PRODUCT_REFRESH" ? null : `SGM-${o.state}-SYN-${{ notice: "100.10", eligibility: "200.20", coverage: "300.30", catastrophe: "400.40", claims: "500.50" }[category(factSection.get(o.fact_id)!)]}`;
      await client.query(
        `INSERT INTO overrides (product_id, state, edition, fact_id, replacement_value, replacement_conditions, reason_code, regulation_rule_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [o.product_id, o.state, o.edition, o.fact_id, o.replacement_value,
          o.replacement_conditions ? JSON.stringify(o.replacement_conditions) : null, o.reason_code, rule],
      );
    }

    const docs: ManifestDoc[] = manifest.documents;
    for (const d of docs) {
      for (const a of d.artifacts) {
        await client.query(
          `INSERT INTO artifacts (artifact_id, edition_id, parent_artifact_id, role, format, path, sha256, byte_size, uploaded_by,
             uploaded_at, renderer_version, immutable)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)`,
          [a.artifact_id, d.edition_id, a.parent_artifact_id, a.role, a.format, a.path, a.sha256, a.byte_size, a.uploaded_by,
            d.edition === 1 ? "2019-06-01T12:00:00Z" : "2025-06-02T12:00:00Z", a.renderer_version],
        );
      }
      await client.query(
        `UPDATE documents SET published_pdf_artifact_id=$2, page_count=$3, generator_version=$4, image_only_pages=$5
         WHERE document_id=$1`,
        [d.document_id, d.published_pdf_artifact_id, d.page_count, d.generator_version, d.image_only_pages],
      );
      await client.query("UPDATE editions SET change_summary=$2 WHERE edition_id=$1", [d.edition_id, d.change_summary]);
      const pdf = d.artifacts.find((a) => a.artifact_id === d.published_pdf_artifact_id)!;
      const source = d.artifacts.find((a) => a.role === "source-odt") ?? pdf;
      await client.query(
        "INSERT INTO index_status (document_id, artifact_sha256, state) VALUES ($1,$2,'queued')",
        [d.document_id, pdf.sha256],
      );
      const year = d.edition === 1 ? 2019 : 2025;
      const trail: Array<[string, string, string, string | null]> =
        d.edition === 1
          ? [
              ["submitted", "SGM Compliance (synthetic)", `${year}-04-01`, `${SIM}: legacy edition filed.`],
              ["approved", `${d.state} Dept. of Insurance (simulated)`, `${year}-05-15`, `${SIM}: simulated approval receipt.`],
              ["published", "SGM Product Publishing (synthetic)", `${year}-07-01`, null],
              ["superseded", "SGM Product Publishing (synthetic)", "2026-01-01", "Superseded by edition 2."],
            ]
          : [
              ["draft", "M. Gander, Product (synthetic)", `${year}-06-02`, "Edition 2 converted to editable ODT."],
              ["internal_review", "SGM Underwriting Review (synthetic)", `${year}-07-01`, null],
              ["ready_for_filing", "SGM Compliance (synthetic)", `${year}-08-01`, null],
              ["submitted", "SGM Compliance (synthetic)", `${year}-08-15`, `${SIM}: no real DOI submission was made.`],
              ["approved", `${d.state} Dept. of Insurance (simulated)`, `${year}-10-15`, `${SIM}: simulated approval receipt.`],
              ["published", "SGM Product Publishing (synthetic)", "2026-01-01", null],
            ];
      for (const [stage, actor, ts, notes] of trail) {
        const receipt = stage === "approved" ? `SIM-DOI-${d.state}-${year}-${d.document_id.slice(4)}` : null;
        await client.query(
          `INSERT INTO approval_events (edition_id, stage, actor, timestamp, notes, artifact_sha256, simulated_receipt_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [d.edition_id, stage, actor, `${ts}T15:00:00Z`, notes, source.sha256, receipt],
        );
      }
    }

    const cols: Record<string, unknown[]> = { doc: [], ed: [], fact: [], sec: [], page: [], text: [], conf: [], art: [], ver: [] };
    const rl = readline.createInterface({ input: createReadStream(path.join(corpusDir, "evidence.jsonl")) });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const e = JSON.parse(line);
      cols.doc.push(e.document_id); cols.ed.push(e.edition_id); cols.fact.push(e.fact_id); cols.sec.push(e.section_id);
      cols.page.push(e.page); cols.text.push(e.text); cols.conf.push(e.confidence); cols.art.push(e.source_artifact_id);
      cols.ver.push(e.extraction_version);
    }
    await client.query(
      `INSERT INTO evidence_spans (document_id, edition_id, fact_id, section_id, page, text, confidence, source_artifact_id, extraction_version)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::text[], $7::real[], $8::text[], $9::text[])`,
      [cols.doc, cols.ed, cols.fact, cols.sec, cols.page, cols.text, cols.conf, cols.art, cols.ver],
    );
    await client.query("COMMIT");
    console.log(`loaded ${docs.length} documents, ${cols.doc.length} evidence spans, ${canonical.overrides.length} overrides`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
