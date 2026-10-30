import Link from "next/link";
import { compareMatrix, listSections } from "@/lib/compare";
import { formatFactValue, listProducts, listStates } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare states" };

export default async function Compare({ searchParams }: { searchParams: { product?: string; edition?: string; section?: string } }) {
  const [products, stateList] = await Promise.all([listProducts(), listStates()]);
  const STATES = Object.fromEntries(stateList.map((s) => [s.code, s.name]));
  const product = products.some((p) => p.id === searchParams.product) ? searchParams.product! : products[0].id;
  const edition = searchParams.edition === "1" ? 1 : 2;
  const sections = await listSections(product);
  const section = sections.some((s) => s.section_id === searchParams.section) ? searchParams.section : undefined;
  const matrix = await compareMatrix(product, edition, section);

  return (
    <div className="container-page py-10">
      <h1 className="font-serif text-4xl">Compare states</h1>
      <p className="mt-2 max-w-3xl muted">
        The effective value of each guide term in every state, for edition {edition}. Teal cells differ from the baseline;
        every number is synthetic demo content.
      </p>
      <form className="card mt-6 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-48">
          <label htmlFor="product" className="block text-sm font-semibold">Product</label>
          <select id="product" name="product" defaultValue={product} className="field mt-1 w-full">
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.family}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="edition" className="block text-sm font-semibold">Edition</label>
          <select id="edition" name="edition" defaultValue={String(edition)} className="field mt-1">
            <option value="2">Edition 2 (current)</option>
            <option value="1">Edition 1 (legacy)</option>
          </select>
        </div>
        <div className="min-w-56">
          <label htmlFor="section" className="block text-sm font-semibold">Section</label>
          <select id="section" name="section" defaultValue={section ?? ""} className="field mt-1 w-full">
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s.section_id} value={s.section_id}>{s.title}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary">Compare</button>
      </form>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-max text-left text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              <th className="sticky left-0 z-10 bg-[var(--card)] p-2 font-semibold">State</th>
              {matrix.columns.map((c, ci) => (
                <th key={c.fact_id} className="max-w-44 p-2 align-top font-medium" title={c.fact_id}>
                  {c.topic}
                  <span className="block font-normal muted">baseline {formatFactValue(matrix.baseline[ci], matrix.rows[0]?.cells[ci]?.unit ?? null)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((r) => (
              <tr key={r.state} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                <th className="sticky left-0 z-10 bg-[var(--card)] p-2 font-semibold">{STATES[r.state] ?? r.state}</th>
                {r.cells.map((cell, ci) => (
                  <td key={matrix.columns[ci].fact_id} className={`max-w-44 break-words p-2 ${cell.overridden ? "bg-teal-50 font-medium text-teal-800 dark:bg-navy-700 dark:text-teal" : "muted"}`}>
                    <Link href={`/guides/SGM-${matrix.columns[ci].fact_id.split(".")[0]}-${r.state}-E${edition}`} className="hover:underline" title={cell.rule_id ? `synthetic rule ${cell.rule_id}` : "baseline"}>
                      {formatFactValue(cell.value, cell.unit)}
                    </Link>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {matrix.rows.length === 0 && <p className="p-6 muted">No facts found for this selection.</p>}
      </div>
      <p className="mt-3 text-xs muted">
        {matrix.rows.length} states × {matrix.columns.length} terms · teal = state override from the baseline (edition {edition}) ·
        click a cell to open that state&rsquo;s guide
      </p>
    </div>
  );
}
