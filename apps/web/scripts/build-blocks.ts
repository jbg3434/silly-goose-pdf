// Build GuideBlock records from the canonical fact model.
// Every answer-bearing term becomes a reviewed block; chunk page spans give
// each block its source-page citation. Idempotent: rebuilds per document.
// Synthetic demo content — not an insurance contract or coverage advice.
import { pool } from "../src/lib/db";

type Doc = { document_id: string; edition_id: string; product_id: string; state: string; edition_number: number };
type Section = { section_id: string; number: string; title: string; sort_order: number };
type Fact = {
  fact_id: string; section_id: string; topic: string; statement_template: string; value: string; unit: string | null;
  conditions: unknown; footnotes: unknown; in_table: boolean;
};
type Override = { replacement_value: string | null; replacement_conditions: unknown; reason_code: string };

function render(stmt: string, value: string | null, unit: string | null): string {
  const v =
    value === null ? "not offered" :
    unit === "USD" ? `$${Number(value).toLocaleString("en-US")}` :
    unit === "percent" ? `${value}%` :
    unit ? `${Number(value).toLocaleString("en-US")} ${unit}` : value;
  return stmt.replace("{value}", v);
}

async function main() {
  const onlyDoc = process.env.SGM_DOC;
  const { rows: docs } = await pool.query<Doc>(
    `SELECT d.document_id, d.edition_id, d.product_id, d.state, e.edition_number
     FROM documents d JOIN editions e ON e.edition_id = d.edition_id
     ${onlyDoc ? "WHERE d.document_id = $1" : ""} ORDER BY d.document_id`,
    onlyDoc ? [onlyDoc] : [],
  );
  let total = 0;
  for (const d of docs) {
    const [sections, facts, overrides, pages] = await Promise.all([
      pool.query<Section>(
        `SELECT s.section_id, s.number, s.title, s.sort_order FROM sections s
         WHERE s.product_id = $1 AND EXISTS (
           SELECT 1 FROM facts f WHERE f.product_id = s.product_id AND f.section_id = s.section_id AND f.introduced_edition <= $2
         ) ORDER BY s.sort_order`,
        [d.product_id, d.edition_number],
      ),
      pool.query<Fact>(
        `SELECT fact_id, section_id, topic, statement_template, value, unit, conditions, footnotes, in_table
         FROM facts WHERE product_id = $1 AND introduced_edition <= $2 ORDER BY fact_id`,
        [d.product_id, d.edition_number],
      ),
      pool.query<Override & { fact_id: string }>(
        `SELECT DISTINCT ON (fact_id) fact_id, replacement_value, replacement_conditions, reason_code
         FROM overrides WHERE product_id = $1 AND state = $2 AND edition <= $3
         ORDER BY fact_id, edition DESC`,
        [d.product_id, d.state, d.edition_number],
      ),
      // min/max source page for each fact via chunks that carry the fact_id
      pool.query<{ fact_id: string; page_start: number; page_end: number }>(
        `SELECT f.fact_id, min(c.page_start) AS page_start, max(c.page_end) AS page_end
         FROM chunks c, unnest(c.fact_ids) f(fact_id) WHERE c.document_id = $1 GROUP BY f.fact_id`,
        [d.document_id],
      ),
    ]);
    const ovMap = new Map(overrides.rows.map((o) => [o.fact_id, o]));
    const pgMap = new Map(pages.rows.map((p) => [p.fact_id, p]));
    const blocks: [string, number, string, unknown, string[], number | null, number | null][] = [];
    let order = 0;
    for (const s of sections.rows) {
      const secFacts = facts.rows.filter((f) => f.section_id === s.section_id);
      blocks.push([s.section_id, order++, "heading", { number: s.number, title: s.title }, [], null, null]);
      const termFacts = secFacts.filter((f) => !f.in_table);
      const tableFacts = secFacts.filter((f) => f.in_table);
      for (const f of termFacts) {
        const ov = ovMap.get(f.fact_id);
        const value = ov ? ov.replacement_value : f.value;
        const pg = pgMap.get(f.fact_id);
        blocks.push([s.section_id, order++, "term", {
          topic: f.topic,
          statement: render(f.statement_template, value, f.unit),
          value,
          unit: f.unit,
          conditions: ov?.replacement_conditions ?? f.conditions,
          footnotes: f.footnotes,
          overridden: !!ov,
        }, [f.fact_id], pg?.page_start ?? null, pg?.page_end ?? null]);
      }
      if (tableFacts.length) {
        const pg = tableFacts.map((f) => pgMap.get(f.fact_id)).filter(Boolean);
        blocks.push([s.section_id, order++, "table", {
          caption: `${s.title} — terms`,
          columns: ["Term", "Value", "Basis"],
          rows: tableFacts.map((f) => {
            const ov = ovMap.get(f.fact_id);
            return [f.topic, render("{value}", ov ? ov.replacement_value : f.value, f.unit), ov ? `${d.state} override (${ov.reason_code})` : "baseline"];
          }),
        }, tableFacts.map((f) => f.fact_id),
          pg.length ? Math.min(...pg.map((p) => p!.page_start)) : null,
          pg.length ? Math.max(...pg.map((p) => p!.page_end)) : null]);
      }
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM guide_blocks WHERE document_id = $1", [d.document_id]);
      for (const [sectionId, o, kind, content, factIds, ps, pe] of blocks) {
        const sec = sections.rows.find((s) => s.section_id === sectionId)!;
        await client.query(
          `INSERT INTO guide_blocks (block_id, document_id, edition_id, section_id, section_title, sort_order, kind, content, fact_ids, page_start, page_end, review_state)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'verified')`,
          [`GB-${d.document_id}-${String(o).padStart(3, "0")}`, d.document_id, d.edition_id, sectionId, sec.title, o, kind, JSON.stringify(content), factIds, ps, pe],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    total += blocks.length;
    if (docs.length > 100 && total % 10000 < 300) console.log(`${d.document_id} done`);
  }
  console.log(`built ${total} blocks for ${docs.length} documents`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
