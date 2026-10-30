import { pool } from "./db";

export type MatrixCell = {
  value: string | null;
  unit: string | null;
  overridden: boolean;
  edition: number;
  rule_id: string | null;
};
export type MatrixColumn = { fact_id: string; topic: string; section_id: string; in_table: boolean };
export type Matrix = {
  columns: MatrixColumn[];
  rows: { state: string; cells: MatrixCell[] }[];
  baseline: (string | null)[];
};

export async function compareMatrix(productId: string, edition: number, sectionId?: string): Promise<Matrix> {
  const { rows } = await pool.query<{
    state: string; fact_id: string; topic: string; section_id: string; in_table: boolean;
    baseline: string | null; unit: string | null;
    replacement_value: string | null; o_edition: number | null; rule_id: string | null;
  }>(
    `SELECT st.code AS state, f.fact_id, f.topic, f.section_id, f.in_table, f.value AS baseline, f.unit,
            o.replacement_value, o.edition AS o_edition, o.regulation_rule_id AS rule_id
     FROM states st
     CROSS JOIN facts f
     LEFT JOIN LATERAL (
       SELECT replacement_value, edition, regulation_rule_id FROM overrides
       WHERE product_id = f.product_id AND state = st.code AND fact_id = f.fact_id AND edition <= $2
       ORDER BY edition DESC LIMIT 1
     ) o ON true
     WHERE f.product_id = $1 AND f.introduced_edition <= $2
       AND ($3::text IS NULL OR f.section_id = $3)
     ORDER BY f.section_id, f.fact_id, st.code`,
    [productId, edition, sectionId ?? null],
  );
  const colIdx = new Map<string, number>();
  const columns: MatrixColumn[] = [];
  const byState = new Map<string, MatrixCell[]>();
  for (const r of rows) {
    let ci = colIdx.get(r.fact_id);
    if (ci === undefined) {
      ci = columns.length;
      colIdx.set(r.fact_id, ci);
      columns.push({ fact_id: r.fact_id, topic: r.topic, section_id: r.section_id, in_table: r.in_table });
    }
    let st = byState.get(r.state);
    if (!st) byState.set(r.state, (st = []));
    st[ci] = {
      value: r.o_edition === null ? r.baseline : r.replacement_value,
      unit: r.unit,
      overridden: r.o_edition !== null,
      edition: r.o_edition ?? 0,
      rule_id: r.rule_id,
    };
  }
  const baseline = rows.length
    ? columns.map((c) => rows.find((r) => r.fact_id === c.fact_id)?.baseline ?? null)
    : [];
  return {
    columns,
    rows: Array.from(byState.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([state, cells]) => ({ state, cells })),
    baseline,
  };
}

export async function listSections(productId: string) {
  const { rows } = await pool.query<{ section_id: string; title: string }>(
    `SELECT s.section_id, s.title FROM sections s
     WHERE s.product_id = $1 AND EXISTS (SELECT 1 FROM facts f WHERE f.product_id = s.product_id AND f.section_id = s.section_id)
     ORDER BY s.title`,
    [productId],
  );
  return rows;
}
