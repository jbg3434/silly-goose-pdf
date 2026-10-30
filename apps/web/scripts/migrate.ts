import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pool } from "../src/lib/db";

const dir = path.resolve(__dirname, "../../../db/migrations");

async function main() {
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = new Set(
      (await client.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map(
        (r) => r.version,
      ),
    );
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      if (applied.has(file)) continue;
      const sql = readFileSync(path.join(dir, file), "utf8").replace(
        /CREATE TABLE schema_migrations[\s\S]*?\);\s*$/m,
        "",
      );
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
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
