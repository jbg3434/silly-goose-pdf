import { readFileSync } from "node:fs";
import path from "node:path";
import { pool } from "../src/lib/db";

const dataDir = path.resolve(__dirname, "../../../data");
const load = <T>(name: string): T => JSON.parse(readFileSync(path.join(dataDir, name), "utf8"));

type State = { code: string; name: string };
type Product = { id: string; family: string; line: string; display_name: string; code: string; summary: string };
type EditionDef = { edition: number; effective_date: string; revision: string; source_format: string };

// Seeds catalog metadata and edition lineage for every product × state × edition.
// Artifacts (PDF/ODT/DOCX), page counts, and approval events are registered by the corpus build.
async function main() {
  const states = load<State[]>("states.json");
  const products = load<Product[]>("products.json");
  const editions = load<EditionDef[]>("editions.json").sort((a, b) => a.edition - b.edition);
  const latest = editions[editions.length - 1].edition;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const s of states) {
      await client.query(
        "INSERT INTO states (code, name) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name",
        [s.code, s.name],
      );
    }
    for (const p of products) {
      await client.query(
        `INSERT INTO products (id, family, line, display_name, code, summary) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET family=EXCLUDED.family, line=EXCLUDED.line,
           display_name=EXCLUDED.display_name, code=EXCLUDED.code, summary=EXCLUDED.summary`,
        [p.id, p.family, p.line, p.display_name, p.code, p.summary],
      );
      for (const s of states) {
        const lineageId = `${p.code}-${s.code}`;
        await client.query(
          "INSERT INTO lineages (lineage_id, product_id, state) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [lineageId, p.id, s.code],
        );
        let parent: string | null = null;
        for (const e of editions) {
          const editionId = `${lineageId}-E${e.edition}`;
          const isLatest = e.edition === latest;
          await client.query(
            `INSERT INTO editions (edition_id, lineage_id, parent_edition_id, edition_number, effective_date,
               revision, source_format, approval_state, publication_state, current_from, current_to)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'approved',$8,$9,$10)
             ON CONFLICT (edition_id) DO NOTHING`,
            [
              editionId, lineageId, parent, e.edition, e.effective_date, e.revision, e.source_format,
              isLatest ? "published" : "superseded",
              e.effective_date,
              isLatest ? null : editions.find((x) => x.edition === e.edition + 1)?.effective_date ?? null,
            ],
          );
          await client.query(
            `INSERT INTO documents (document_id, product_id, state, edition_id)
             VALUES ($1,$2,$3,$4) ON CONFLICT (document_id) DO NOTHING`,
            [`SGM-${editionId}`, p.id, s.code, editionId],
          );
          parent = editionId;
        }
      }
    }
    await client.query("COMMIT");
    const { rows } = await client.query("SELECT count(*)::int AS n FROM documents");
    console.log(`seeded ${products.length} products × ${states.length} states × ${editions.length} editions = ${rows[0].n} documents`);
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
