import { Pool } from "pg";

const globalForPool = globalThis as unknown as { sgmPool?: Pool };

export const pool =
  globalForPool.sgmPool ??
  new Pool({
    // Managed Postgres (e.g. Render) requires TLS; the compose DB does not.
    connectionString:
      process.env.DATABASE_URL ?? "postgres://goose:goose@localhost:5433/silly_goose",
    ssl: process.env.DATABASE_URL?.includes("localhost")
      ? undefined
      : process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : undefined,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForPool.sgmPool = pool;
