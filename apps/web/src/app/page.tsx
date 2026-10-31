import Link from "next/link";
import { Gus } from "@/components/gus/Gus";
import { corpusStats, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [products, stats] = await Promise.all([listProducts(), corpusStats()]);
  return (
    <>
      <section className="bg-navy text-ivory">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-amber">Synthetic product guide library</p>
            <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
              A thousand nearly identical guides. One tiny state difference. Find it.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-ivory-200">
              Silly Goose Mutual is a fictional insurer built to stress-test document intelligence: {stats.products} product families
              × {stats.states} states × 2 editions, from an awkward legacy PDF to a clean, editable successor. Every term is invented.
            </p>
            <form action="/search" className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row" role="search">
              <label htmlFor="home-q" className="sr-only">
                Ask or search across all {stats.documents} guides
              </label>
              <input
                id="home-q"
                name="q"
                autoFocus
                className="w-full rounded-lg border-0 px-4 py-3 text-navy placeholder:text-slate"
                placeholder="Ask anything — e.g. does the WA watercraft guide cap at 40 feet?"
              />
              <button className="btn rounded-lg bg-amber px-6 py-3 text-navy hover:bg-ivory">Search</button>
            </form>
            <p className="mt-3 max-w-xl text-sm text-ivory-200">
              Searches all {stats.documents.toLocaleString()} indexed guides. Or browse{" "}
              <Link href="/products" className="underline">products by state</Link> or{" "}
              <Link href="/library" className="underline">all guides</Link>.
            </p>
          </div>
          <div className="flex justify-center">
            <Gus pose="idle" size={260} idleBob reaction={{ pose: "honk", cue: "honk" }} className="text-left" />
          </div>
        </div>
      </section>

      <section className="container-page py-12" aria-labelledby="products-h">
        <div className="flex items-end justify-between gap-4">
          <h2 id="products-h" className="font-serif text-3xl">
            Product families
          </h2>
          <Link href="/products" className="link text-sm">
            View the catalog
          </Link>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {products.map((p) => (
            <li key={p.id} className="card relative p-4 hover:shadow-md">
              <p className="text-xs font-semibold uppercase tracking-wide muted">{p.line}</p>
              <h3 className="mt-1 font-serif text-lg leading-snug">
                <Link href={`/products/${p.id}`} className="after:absolute after:inset-0 hover:underline">
                  {p.family}
                </Link>
              </h3>
              <p className="mt-1 text-sm muted">{p.display_name}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page grid gap-6 pb-4 md:grid-cols-3" aria-label="What this demo shows">
        {[
          ["Legacy to editable", "Edition 1 arrives as a dense, dated PDF. Edition 2 is rebuilt as an open ODT source with a DOCX export and a modern PDF."],
          ["Citations, not vibes", "Every answer points to the exact guide, edition, section, page, and quoted passage — or says it is not found."],
          ["Simulated approvals", "Draft, review, filing, and approval are recorded against exact artifact hashes in a clearly labeled simulated DOI workflow."],
        ].map(([t, b]) => (
          <div key={t} className="card p-5">
            <h3 className="font-serif text-xl">{t}</h3>
            <p className="mt-2 text-sm muted">{b}</p>
          </div>
        ))}
      </section>
    </>
  );
}
