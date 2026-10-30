// Scores lexical, vector, and hybrid retrieval against data/ground-truth/eval-queries.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pool } from "../src/lib/db";
import { EMBEDDING_ID } from "../src/lib/embed";
import { MODES, type Mode, type Scope, search } from "../src/lib/search";

const ROOT = path.resolve(__dirname, "../../..");
type Expected = { document_id: string; fact_id: string; page: number };
type Item = {
  id: string; kind: string; query: string; expected: Expected[]; answer_present: boolean; absent_fact_id?: string;
  scope: { product_id?: string; states?: string[]; edition?: number; document_id?: string };
};
type Doc = { product_id: string; state: string; edition_number: number; is_current: boolean; sha256: string; page_count: number };

const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 100);
const p = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(q * xs.length) - 1)] ?? 0;

async function main() {
  const fixture = JSON.parse(readFileSync(path.join(ROOT, "data/ground-truth/eval-queries.json"), "utf8"));
  const items: Item[] = fixture.items;
  const modes = (process.argv.find((a) => a.startsWith("--modes="))?.slice(8).split(",") as Mode[]) ?? [...MODES];
  const docs = new Map<string, Doc>(
    (
      await pool.query(
        `SELECT d.document_id, d.product_id, d.state, e.edition_number, d.page_count, a.sha256,
           (e.publication_state = 'published' AND e.current_to IS NULL) AS is_current
         FROM documents d JOIN editions e USING (edition_id) JOIN artifacts a ON a.artifact_id = d.published_pdf_artifact_id`,
      )
    ).rows.map((r) => [r.document_id, r]),
  );
  const cov = (await pool.query("SELECT state, count(*)::int AS n FROM index_status GROUP BY state")).rows;
  await search("warm up", {}, { persist: false });

  const summary: Record<string, unknown> = {};
  const details: Record<string, unknown[]> = {};
  for (const mode of modes) {
    const rows = [];
    for (const it of items) {
      const scope: Scope = { ...it.scope };
      const res = await search(it.query, scope, { mode, k: 10, persist: false });
      const top = res.results;
      const found = it.expected.map((e) => top.some((h) => h.document_id === e.document_id && h.fact_ids.includes(e.fact_id)));
      const violations = top.filter((h) => {
        const d = docs.get(h.document_id)!;
        const s = it.scope;
        if (s.document_id) return h.document_id !== s.document_id;
        if (s.product_id && d.product_id !== s.product_id) return true;
        if (s.states && !s.states.includes(d.state)) return true;
        if (s.edition !== undefined) return d.edition_number !== s.edition;
        return !d.is_current;
      });
      const invalid = top.filter((h) => {
        const d = docs.get(h.document_id);
        return !d || d.sha256 !== h.artifact_sha256 || h.page_start < 1 || h.page_end > d.page_count;
      });
      const absentHits = it.absent_fact_id ? top.filter((h) => h.fact_ids.includes(it.absent_fact_id!)).length : 0;
      rows.push({
        id: it.id, kind: it.kind.split(":")[0], query: it.query, answer_present: it.answer_present,
        hit: it.expected.length ? found.every(Boolean) : null,
        first_rank: it.expected.length
          ? Math.max(...it.expected.map((e) => top.findIndex((h) => h.document_id === e.document_id && h.fact_ids.includes(e.fact_id)) + 1 || 99))
          : null,
        scope_violations: violations.length, invalid_citations: invalid.length, absent_fact_hits: absentHits,
        latency_ms: res.latency_ms, top3: top.slice(0, 3).map((h) => `${h.chunk_id} p${h.page_start} [${h.fact_ids.join(",")}]`),
      });
    }
    const scored = rows.filter((r) => r.hit !== null);
    const byKind: Record<string, string> = {};
    for (const kind of Array.from(new Set(scored.map((r) => r.kind)))) {
      const k = scored.filter((r) => r.kind === kind);
      byKind[kind] = `${k.filter((r) => r.hit).length}/${k.length}`;
    }
    const lat = rows.map((r) => r.latency_ms);
    const results = rows.reduce((a, r) => a + Math.min(10, r.top3.length ? 10 : 0), 0);
    summary[mode] = {
      queries: rows.length,
      scored_queries: scored.length,
      recall_at_10: pct(scored.filter((r) => r.hit).length, scored.length),
      mrr: Math.round((1000 * scored.reduce((a, r) => a + (r.first_rank! <= 10 ? 1 / r.first_rank! : 0), 0)) / scored.length) / 1000,
      by_kind: byKind,
      scope_violations: rows.reduce((a, r) => a + r.scope_violations, 0),
      invalid_citations: rows.reduce((a, r) => a + r.invalid_citations, 0),
      citation_validity: pct(results - rows.reduce((a, r) => a + r.invalid_citations, 0), results),
      absent_fact_hits: rows.reduce((a, r) => a + r.absent_fact_hits, 0),
      latency_p50_ms: p(lat, 0.5),
      latency_p95_ms: p(lat, 0.95),
      misses: scored.filter((r) => !r.hit).map((r) => r.id),
    };
    details[mode] = rows;
    console.log(mode, JSON.stringify(summary[mode]));
  }
  const report = { generated_at: new Date().toISOString(), embedding_model: EMBEDDING_ID, fixture_count: items.length, index_status: cov, summary };
  const out = path.join(ROOT, "reports/eval");
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "retrieval-summary.json"), JSON.stringify(report, null, 1) + "\n");
  writeFileSync(path.join(out, "retrieval-details.json"), JSON.stringify(details, null, 1) + "\n");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
