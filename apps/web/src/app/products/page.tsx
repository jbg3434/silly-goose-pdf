import Link from "next/link";
import { Gus } from "@/components/gus/Gus";
import { listProducts, productDocCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Product catalog" };

export default async function Products() {
  const [products, counts] = await Promise.all([listProducts(), productDocCounts()]);
  const lines = ["personal", "commercial"] as const;
  return (
    <div className="container-page py-10">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="font-serif text-4xl">Product catalog</h1>
          <p className="mt-2 max-w-2xl muted">
            Ten fictional product families, each with a state guide for all 50 states and two editions. Generic family labels are
            kept for filtering; the Silly Goose names are display labels.
          </p>
        </div>
        <Gus pose="sideeye" size={110} decorative className="hidden md:inline-block" />
      </div>
      {lines.map((line) => (
        <section key={line} className="mt-10" aria-labelledby={`${line}-h`}>
          <h2 id={`${line}-h`} className="font-serif text-2xl capitalize">
            {line} lines
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {products
              .filter((p) => p.line === line)
              .map((p) => (
                <li key={p.id} className="card flex flex-col gap-2 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide muted">
                        {p.family} · {p.code}
                      </p>
                      <h3 className="font-serif text-xl">{p.display_name}</h3>
                    </div>
                    <span className="badge-synthetic">Synthetic</span>
                  </div>
                  <p className="text-sm muted">{p.summary}</p>
                  <p className="text-sm">
                    {counts[p.id]?.states ?? 0} states · {counts[p.id]?.editions ?? 0} guide editions
                  </p>
                  <div className="mt-auto flex gap-2 pt-2">
                    <Link href={`/library?product=${p.id}`} className="btn-primary">
                      Browse current guides
                    </Link>
                    <Link href={`/library?product=${p.id}&edition=all`} className="btn-secondary">
                      All editions
                    </Link>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
