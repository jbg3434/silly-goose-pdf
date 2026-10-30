import { Pool } from "pg";

const globalForPool = globalThis as unknown as { sgmPool?: Pool };

export const pool =
  globalForPool.sgmPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://goose:goose@localhost:5433/silly_goose",
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForPool.sgmPool = pool;
