import { pool } from "./db";

export type Product = { id: string; family: string; line: string; display_name: string; code: string; summary: string };
export type State = { code: string; name: string };

export type DocumentRow = {
  document_id: string;
  product_id: string;
  family: string;
  display_name: string;
  state: string;
  state_name: string;
  edition_id: string;
  edition_number: number;
  effective_date: string;
  revision: string;
  source_format: string;
  approval_state: string;
  publication_state: string;
  page_count: number | null;
  index_state: string | null;
};

export const SORTS = {
  product: "p.family, d.state, e.edition_number DESC",
  state: "s.name, p.family, e.edition_number DESC",
  effective_desc: "e.effective_date DESC, p.family, d.state",
  effective_asc: "e.effective_date ASC, p.family, d.state",
} as const;
export type SortKey = keyof typeof SORTS;

export const PAGE_SIZE = 24;

export type LibraryFilters = {
  q?: string;
  product?: string[];
  state?: string[];
  edition?: "current" | "all" | "1" | "2";
  format?: string;
  approval?: string;
  status?: string;
  sort?: SortKey;
  page?: number;
};

export async function listProducts(): Promise<Product[]> {
  return (await pool.query<Product>("SELECT * FROM products ORDER BY line DESC, family")).rows;
}

export async function listStates(): Promise<State[]> {
  return (await pool.query<State>("SELECT code, name FROM states ORDER BY name")).rows;
}

export async function productDocCounts(): Promise<Record<string, { states: number; editions: number }>> {
  const { rows } = await pool.query<{ product_id: string; states: number; editions: number }>(
    "SELECT product_id, count(DISTINCT state)::int AS states, count(*)::int AS editions FROM documents GROUP BY product_id",
  );
  return Object.fromEntries(rows.map((r) => [r.product_id, { states: r.states, editions: r.editions }]));
}

export async function listDocuments(f: LibraryFilters) {
  const where: string[] = [];
  const args: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    args.push(v);
    where.push(sql.replace("?", `$${args.length}`));
  };
  if (f.q) {
    add(
      "(p.family ILIKE ? OR p.display_name ILIKE $X OR s.name ILIKE $X OR d.state ILIKE $X OR d.document_id ILIKE $X)".replace(
        /\$X/g,
        `$${args.length + 1}`,
      ),
      `%${f.q}%`,
    );
  }
  if (f.product?.length) add("d.product_id = ANY(?)", f.product);
  if (f.state?.length) add("d.state = ANY(?)", f.state);
  const edition = f.edition ?? "current";
  if (edition === "current") where.push("e.publication_state = 'published' AND e.current_to IS NULL");
  else if (edition !== "all") add("e.edition_number = ?", Number(edition));
  if (f.format) add("e.source_format = ?", f.format);
  if (f.approval) add("e.approval_state = ?::approval_state", f.approval);
  if (f.status) add("e.publication_state = ?::publication_state", f.status);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const from = `FROM documents d
    JOIN products p ON p.id = d.product_id
    JOIN states s ON s.code = d.state
    JOIN editions e ON e.edition_id = d.edition_id
    LEFT JOIN index_status i ON i.document_id = d.document_id`;
  const page = Math.max(1, f.page ?? 1);
  const order = SORTS[f.sort ?? "product"] ?? SORTS.product;

  const [{ rows }, count] = await Promise.all([
    pool.query<DocumentRow>(
      `SELECT d.document_id, d.product_id, p.family, p.display_name, d.state, s.name AS state_name,
              d.edition_id, e.edition_number, to_char(e.effective_date, 'YYYY-MM-DD') AS effective_date,
              e.revision, e.source_format, e.approval_state, e.publication_state, d.page_count,
              i.state AS index_state
       ${from} ${whereSql} ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      args,
    ),
    pool.query<{ n: number }>(`SELECT count(*)::int AS n ${from} ${whereSql}`, args),
  ]);
  return { rows, total: count.rows[0].n, page, pageSize: PAGE_SIZE };
}

export async function getDocument(documentId: string) {
  const { rows } = await pool.query<DocumentRow & { lineage_id: string; summary: string; change_summary: string | null }>(
    `SELECT d.document_id, d.product_id, p.family, p.display_name, p.summary, d.state, s.name AS state_name,
            d.edition_id, e.lineage_id, e.edition_number, to_char(e.effective_date, 'YYYY-MM-DD') AS effective_date,
            e.revision, e.source_format, e.approval_state, e.publication_state, e.change_summary, d.page_count,
            i.state AS index_state
     FROM documents d JOIN products p ON p.id = d.product_id JOIN states s ON s.code = d.state
     JOIN editions e ON e.edition_id = d.edition_id LEFT JOIN index_status i ON i.document_id = d.document_id
     WHERE d.document_id = $1`,
    [documentId],
  );
  if (!rows[0]) return null;
  const lineage = await pool.query<{
    document_id: string;
    edition_number: number;
    effective_date: string;
    revision: string;
    source_format: string;
    approval_state: string;
    publication_state: string;
  }>(
    `SELECT d.document_id, e.edition_number, to_char(e.effective_date, 'YYYY-MM-DD') AS effective_date, e.revision,
            e.source_format, e.approval_state, e.publication_state
     FROM editions e JOIN documents d ON d.edition_id = e.edition_id
     WHERE e.lineage_id = $1 ORDER BY e.edition_number DESC`,
    [rows[0].lineage_id],
  );
  return { doc: rows[0], lineage: lineage.rows };
}

export async function corpusStats() {
  const { rows } = await pool.query<{ documents: number; products: number; states: number; with_pdf: number }>(
    `SELECT count(*)::int AS documents, count(DISTINCT product_id)::int AS products,
            count(DISTINCT state)::int AS states, count(published_pdf_artifact_id)::int AS with_pdf FROM documents`,
  );
  return rows[0];
}
