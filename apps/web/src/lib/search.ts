import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { embedQuery, toVector } from "./embed";

export const MODES = ["hybrid", "lexical", "vector"] as const;
export type Mode = (typeof MODES)[number];

// Scope comes only from structured parameters; the query text never widens it.
export type Scope = {
  product_id?: string;
  states?: string[];
  edition?: number;
  document_id?: string;
  section_id?: string;
  all_editions?: boolean;
};

export type Hit = {
  chunk_id: string;
  document_id: string;
  product_id: string;
  state: string;
  edition_number: number;
  is_current: boolean;
  section_id: string;
  section_title: string;
  kind: string;
  page_start: number;
  page_end: number;
  fact_ids: string[];
  artifact_sha256: string;
  text: string;
  score: number;
  lexical_rank: number | null;
  vector_rank: number | null;
};

export type Coverage = {
  documents_in_scope: number;
  documents_indexed: number;
  not_indexed: { document_id: string; state: string; error: string | null }[];
};

export type SearchResponse = {
  run_id: string | null;
  query: string;
  mode: Mode;
  scope: Scope & { editions: "current" | "all" | "specific" };
  coverage: Coverage;
  results: Hit[];
  latency_ms: number;
};

export class ScopeError extends Error {}

const RRF_K = 60;
const CANDIDATES = 50;

export async function validateScope(raw: Scope): Promise<Scope> {
  const s: Scope = {};
  if (raw.product_id) {
    const r = await pool.query("SELECT 1 FROM products WHERE id = $1", [raw.product_id]);
    if (!r.rowCount) throw new ScopeError(`Unknown product "${raw.product_id}"`);
    s.product_id = raw.product_id;
  }
  if (raw.states?.length) {
    const states = Array.from(new Set(raw.states.map((x) => x.toUpperCase())));
    const r = await pool.query<{ code: string }>("SELECT code FROM states WHERE code = ANY($1)", [states]);
    const bad = states.filter((x) => !r.rows.some((row) => row.code === x));
    if (bad.length) throw new ScopeError(`Unknown state ${bad.join(", ")}`);
    s.states = states;
  }
  if (raw.edition !== undefined) {
    if (!Number.isInteger(raw.edition) || raw.edition < 1 || raw.edition > 99) throw new ScopeError("Edition must be a positive integer");
    s.edition = raw.edition;
  }
  if (raw.document_id) {
    const r = await pool.query("SELECT 1 FROM documents WHERE document_id = $1", [raw.document_id]);
    if (!r.rowCount) throw new ScopeError(`Unknown document "${raw.document_id}"`);
    s.document_id = raw.document_id;
  }
  if (raw.section_id) s.section_id = raw.section_id;
  if (raw.all_editions) s.all_editions = true;
  return s;
}

// A specific edition or document overrides the default current-only filter.
const currentOnly = (s: Scope) => !s.all_editions && s.edition === undefined && !s.document_id;

function where(s: Scope, params: unknown[], alias = "c", stateOverride?: string) {
  const clauses: string[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    clauses.push(sql.replace("?", `$${params.length}`));
  };
  if (s.product_id) add(`${alias}.product_id = ?`, s.product_id);
  if (stateOverride) add(`${alias}.state = ?`, stateOverride);
  else if (s.states?.length) add(`${alias}.state = ANY(?)`, s.states);
  if (s.edition !== undefined) add("e.edition_number = ?", s.edition);
  if (s.document_id) add(`${alias}.document_id = ?`, s.document_id);
  if (s.section_id && alias === "c") add("c.section_id = ?", s.section_id);
  if (currentOnly(s)) clauses.push("e.publication_state = 'published' AND e.current_to IS NULL");
  return clauses.length ? clauses.join(" AND ") : "TRUE";
}

const HIT_COLUMNS = `c.chunk_id, c.document_id, c.product_id, c.state, e.edition_number,
  (e.publication_state = 'published' AND e.current_to IS NULL) AS is_current, c.section_id, c.section_title, c.kind,
  c.page_start, c.page_end, c.fact_ids, c.artifact_sha256, c.text`;
const INDEXED_JOIN = `JOIN editions e ON e.edition_id = c.edition_id
  JOIN index_status i ON i.document_id = c.document_id AND i.state = 'indexed' AND i.artifact_sha256 = c.artifact_sha256`;

type Row = Omit<Hit, "score" | "lexical_rank" | "vector_rank">;

async function lexical(client: PoolClient, q: string, s: Scope, k: number, state?: string): Promise<Row[]> {
  const params: unknown[] = [q];
  const w = where(s, params, "c", state);
  params.push(k);
  const { rows } = await client.query<Row>(
    `WITH qq AS (
       SELECT plainto_tsquery('english', $1) AS strict,
              NULLIF(array_to_string(tsvector_to_array(to_tsvector('english', $1)), ' | '), '')::tsquery AS loose
     )
     SELECT ${HIT_COLUMNS} FROM chunks c ${INDEXED_JOIN}, qq
     WHERE ${w} AND qq.loose IS NOT NULL AND c.tsv @@ qq.loose
     ORDER BY 2 * ts_rank_cd(c.tsv, qq.strict) + ts_rank_cd(c.tsv, qq.loose, 1) DESC, c.chunk_id
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function vector(client: PoolClient, vec: string, s: Scope, k: number, state?: string): Promise<Row[]> {
  const params: unknown[] = [vec];
  const w = where(s, params, "c", state);
  params.push(k);
  await client.query("SET LOCAL hnsw.ef_search = 200");
  await client.query("SET LOCAL hnsw.iterative_scan = relaxed_order");
  const { rows } = await client.query<Row>(
    `SELECT ${HIT_COLUMNS} FROM chunks c ${INDEXED_JOIN}
     WHERE ${w} AND c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector, c.chunk_id
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

function fuse(lists: { rows: Row[]; key: "lexical_rank" | "vector_rank" }[], k: number): Hit[] {
  const byId = new Map<string, Hit>();
  for (const { rows, key } of lists) {
    rows.forEach((r, i) => {
      const hit = byId.get(r.chunk_id) ?? { ...r, score: 0, lexical_rank: null, vector_rank: null };
      hit[key] = i + 1;
      hit.score += 1 / (RRF_K + i + 1);
      byId.set(r.chunk_id, hit);
    });
  }
  return Array.from(byId.values()).sort((a, b) => b.score - a.score || a.chunk_id.localeCompare(b.chunk_id)).slice(0, k);
}

async function searchOne(client: PoolClient, q: string, vec: string | null, s: Scope, mode: Mode, k: number, state?: string) {
  const lists: { rows: Row[]; key: "lexical_rank" | "vector_rank" }[] = [];
  const n = mode === "hybrid" ? CANDIDATES : k;
  if (mode !== "vector") lists.push({ rows: await lexical(client, q, s, n, state), key: "lexical_rank" });
  if (mode !== "lexical" && vec) lists.push({ rows: await vector(client, vec, s, n, state), key: "vector_rank" });
  return fuse(lists, k);
}

export async function coverage(s: Scope): Promise<Coverage> {
  const params: unknown[] = [];
  const w = where(s, params, "d");
  const { rows } = await pool.query<{ document_id: string; state: string; index_state: string | null; error: string | null }>(
    `SELECT d.document_id, d.state, i.state AS index_state, i.error
     FROM documents d JOIN editions e ON e.edition_id = d.edition_id LEFT JOIN index_status i ON i.document_id = d.document_id
     WHERE ${w} ORDER BY d.document_id`,
    params,
  );
  const missing = rows.filter((r) => r.index_state !== "indexed");
  return {
    documents_in_scope: rows.length,
    documents_indexed: rows.length - missing.length,
    not_indexed: missing.map((r) => ({ document_id: r.document_id, state: r.state, error: r.error ?? `index state: ${r.index_state ?? "none"}` })),
  };
}

export async function search(
  query: string,
  rawScope: Scope,
  opts: { mode?: Mode; k?: number; persist?: boolean } = {},
): Promise<SearchResponse> {
  const t0 = performance.now();
  const q = query.trim().slice(0, 1000);
  if (!q) throw new ScopeError("Query is required");
  const mode = opts.mode ?? "hybrid";
  const k = Math.min(Math.max(opts.k ?? 10, 1), 50);
  const s = await validateScope(rawScope);
  const vec = mode === "lexical" ? null : toVector(await embedQuery(q));
  const client = await pool.connect();
  let results: Hit[];
  try {
    await client.query("BEGIN READ ONLY");
    if (s.states && s.states.length > 1 && !s.document_id) {
      // Gather per state so one state's guides cannot crowd the others out, then interleave.
      const lists: Hit[][] = [];
      for (const st of s.states) lists.push(await searchOne(client, q, vec, s, mode, k, st));
      results = [];
      for (let i = 0; results.length < k * s.states.length && lists.some((l) => l[i]); i++) {
        for (const l of lists) if (l[i]) results.push(l[i]);
      }
    } else {
      results = await searchOne(client, q, vec, s, mode, k);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  const cov = await coverage(s);
  const latency_ms = Math.round(performance.now() - t0);
  const scope = { ...s, editions: currentOnly(s) ? ("current" as const) : s.all_editions ? ("all" as const) : ("specific" as const) };
  let run_id: string | null = null;
  if (opts.persist !== false) {
    run_id = randomUUID();
    await pool.query(
      `INSERT INTO search_runs (run_id, query, scope, documents_considered, failures, mode, latency_ms, result_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run_id, q, JSON.stringify(scope), cov.documents_indexed, JSON.stringify(cov.not_indexed), mode, latency_ms, results.length],
    );
  }
  return { run_id, query: q, mode, scope, coverage: cov, results, latency_ms };
}
