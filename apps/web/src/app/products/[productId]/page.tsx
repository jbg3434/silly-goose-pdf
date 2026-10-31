import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { listProducts, listStates } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { productId: string } }) {
  const [products, states] = await Promise.all([listProducts(), listStates()]);
  const p = products.find((x) => x.id === params.productId || x.code === params.productId);
  if (!p) notFound();
  const { rows: docs } = await pool.query<{ document_id: string; state: string; edition_number: number; is_current: boolean }>(
    `SELECT d.document_id, d.state, e.edition_number, e.current_to IS NULL AS is_current
     FROM documents d JOIN editions e ON e.edition_id = d.edition_id
     WHERE d.product_id = $1 ORDER BY d.state, e.edition_number`,
    [p.id],
  );
  const byState = new Map<string, { current?: string; older: string[] }>();
  for (const d of docs) {
    const e = byState.get(d.state) ?? { older: [] };
    if (d.is_current) e.current = d.document_id; else e.older.push(d.document_id);
    byState.set(d.state, e);
  }
  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="text-sm muted">
        <Link href="/products" className="link">Products</Link> / {p.family}
      </nav>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide muted">{p.line} · {p.code}</p>
      <h1 className="mt-1 font-serif text-4xl">{p.display_name}</h1>
      <p className="mt-3 max-w-2xl muted">{p.summary}</p>
      <h2 className="mt-8 font-serif text-2xl">Pick a state</h2>
      <p className="mt-1 text-sm muted">Every state has its own filed edition — terms can differ. The current edition is preselected.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {states.map((s) => {
          const d = byState.get(s.code);
          return (
            <li key={s.code} className="card p-3 text-sm">
              <p className="font-semibold">{s.name}</p>
              {d?.current ? (
                <Link href={`/guides/${d.current}`} className="link">Current guide</Link>
              ) : (
                <span className="muted">—</span>
              )}
              {d && d.older.length > 0 && (
                <Link href={`/guides/${d.older[d.older.length - 1]}`} className="ml-2 text-xs muted underline">
                  legacy ed.
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm">
        <Link href={`/library?product=${p.id}`} className="link">All {p.family} guides in the library</Link>
        {" · "}
        <Link href={`/compare?product=${p.id}`} className="link">Compare states</Link>
      </p>
    </div>
  );
}
