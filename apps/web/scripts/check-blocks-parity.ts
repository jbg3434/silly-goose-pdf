// GuideBlock parity check: every fact that should appear in a document
// (introduced_edition <= document's edition) must be referenced by at least
// one guide block's fact_ids for that document.
// Synthetic demo content — not an insurance contract or coverage advice.
import { pool } from "../src/lib/db";

async function main() {
  const onlyDoc = process.env.SGM_DOC;
  const { rows } = await pool.query<{ document_id: string; missing: string[] }>(
    `WITH expected AS (
       SELECT d.document_id, f.fact_id
       FROM documents d
       JOIN editions e ON e.edition_id = d.edition_id
       JOIN facts f ON f.product_id = d.product_id AND f.introduced_edition <= e.edition_number
       ${onlyDoc ? "WHERE d.document_id = $1" : ""}
     ), covered AS (
       SELECT document_id, unnest(fact_ids) AS fact_id FROM guide_blocks
     )
     SELECT e.document_id, array_agg(e.fact_id ORDER BY e.fact_id) AS missing
     FROM expected e LEFT JOIN covered c ON c.document_id = e.document_id AND c.fact_id = e.fact_id
     WHERE c.fact_id IS NULL
     GROUP BY e.document_id`,
    onlyDoc ? [onlyDoc] : [],
  );
  let facts = 0;
  for (const r of rows) {
    facts += r.missing.length;
    console.log(`${r.document_id}: ${r.missing.length} missing — ${r.missing.slice(0, 5).join(", ")}`);
  }
  const { rows: counts } = await pool.query<{ docs: string; blocks: string }>(
    "SELECT count(DISTINCT document_id) AS docs, count(*) AS blocks FROM guide_blocks",
  );
  if (!rows.length) {
    console.log(`parity OK: ${counts[0].blocks} blocks over ${counts[0].docs} documents cover every applicable fact`);
    process.exit(0);
  }
  console.log(`parity FAILED: ${facts} missing fact(s) across ${rows.length} document(s)`);
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());
