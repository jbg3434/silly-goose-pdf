import Link from "next/link";
import { listProducts, listStates } from "@/lib/queries";
import { MODES, type Mode, type Scope, ScopeError, type SearchResponse, search } from "@/lib/search";
import { AskBox } from "@/components/search/AskBox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search guides" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const arr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : v.split(",")).filter(Boolean);

const EDITIONS = { current: "Current published only", all: "All editions", "1": "Edition 1 (legacy)", "2": "Edition 2" } as const;
const MODE_LABELS: Record<Mode, string> = { hybrid: "Hybrid (lexical + vector)", lexical: "Lexical (full text)", vector: "Vector (semantic)" };

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const [products, states] = await Promise.all([listProducts(), listStates()]);
  const q = one(searchParams.q)?.slice(0, 500) ?? "";
  const product = one(searchParams.product);
  const picked = arr(searchParams.state).map((s) => s.toUpperCase());
  const ed = one(searchParams.edition) ?? "current";
  const doc = one(searchParams.document);
  const modeParam = one(searchParams.mode) as Mode | undefined;
  const mode: Mode = modeParam && MODES.includes(modeParam) ? modeParam : "hybrid";
  const scope: Scope = {
    product_id: product,
    states: picked.length ? picked : undefined,
    edition: ed === "1" || ed === "2" ? Number(ed) : undefined,
    all_editions: ed === "all",
    document_id: doc,
  };
  let res: SearchResponse | null = null;
  let error: string | null = null;
  if (q) {
    try {
      res = await search(q, scope, { mode, k: 10 });
    } catch (e) {
      if (!(e instanceof ScopeError)) throw e;
      error = e.message;
    }
  }
  const stateName = Object.fromEntries(states.map((s) => [s.code, s.name]));
  const productName = Object.fromEntries(products.map((p) => [p.id, p.family]));

  return (
    <div className="container-page py-10">
      <h1 className="font-serif text-4xl">Search guides</h1>
      <p className="mt-2 muted">
        Passage search across every indexed guide. Filters are applied on the server before ranking, so results never leave the scope you
        choose. <Link href="/search/status" className="underline">Index status</Link>
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <form action="/search" className="card h-fit min-w-0 space-y-3 p-4" aria-label="Search scope">
          <div>
            <label htmlFor="q" className="block text-sm font-semibold">Question or phrase</label>
            <textarea id="q" name="q" defaultValue={q} rows={3} required className="field mt-1 w-full" placeholder="e.g. ransomware sublimit" autoFocus={!q} />
          </div>
          {/* Compact scope chips — the current scope reads as removable pills; edits live in Filters. */}
          <div className="flex flex-wrap gap-1.5 text-xs" aria-label="Current scope">
            {product && <span className="rounded-full bg-teal/15 px-2.5 py-1 font-medium">{productName[product]}</span>}
            {picked.map((s) => <span key={s} className="rounded-full bg-teal/15 px-2.5 py-1 font-medium">{s}</span>)}
            {ed !== "current" && <span className="rounded-full bg-teal/15 px-2.5 py-1 font-medium">{EDITIONS[ed as keyof typeof EDITIONS]}</span>}
            {doc && <span className="rounded-full bg-teal/15 px-2.5 py-1 font-medium">{doc}</span>}
            {(product || picked.length || ed !== "current" || doc) && (
              <Link href={`/search?q=${encodeURIComponent(q)}`} className="rounded-full border px-2.5 py-1 muted" style={{ borderColor: "var(--border)" }}>clear</Link>
            )}
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">Filters</summary>
            <div className="mt-3 space-y-4">
              <div>
                <label htmlFor="product" className="block text-sm font-semibold">Product</label>
                <select id="product" name="product" defaultValue={product ?? ""} className="field mt-1 w-full">
                  <option value="">All products</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.family}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-semibold">States</label>
                <select id="state" name="state" multiple defaultValue={picked} className="field mt-1 h-32 w-full">
                  {states.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                </select>
                <p className="mt-1 text-xs muted">Pick two or more to compare; each state gets its own top results.</p>
              </div>
              <div>
                <label htmlFor="edition" className="block text-sm font-semibold">Edition</label>
                <select id="edition" name="edition" defaultValue={ed} className="field mt-1 w-full">
                  {Object.entries(EDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="mode" className="block text-sm font-semibold">Retrieval mode</label>
                <select id="mode" name="mode" defaultValue={mode} className="field mt-1 w-full">
                  {MODES.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
                </select>
              </div>
            </div>
          </details>
          {doc && <input type="hidden" name="document" value={doc} />}
          <div className="flex gap-2">
            <button className="btn-primary flex-1">Search</button>
            <Link href="/search" className="btn-secondary">Reset</Link>
          </div>
        </form>

        <section aria-labelledby="results-h" className="min-w-0">
          {error && <p role="alert" className="card border-red-500 p-4 text-sm">Search scope problem: {error}</p>}
          {!res && !error && <p className="muted">Enter a question to search. Try “ransomware and extortion sublimit” scoped to New York.</p>}
          {res && (
            <>
              <h2 id="results-h" className="text-lg font-semibold" aria-live="polite">
                {res.results.length} passages <span className="text-sm font-normal muted">· {MODE_LABELS[res.mode]} · {res.latency_ms} ms</span>
              </h2>
              <div className="mt-3">
                <AskBox
                  query={res.query}
                  scope={{ product_id: product, states: picked.length ? picked : undefined, edition: ed === "1" || ed === "2" ? Number(ed) : undefined, all_editions: ed === "all", document_id: doc }}
                />
              </div>
              <p className="mt-1 text-sm muted" data-testid="scope-summary">
                Scope: {res.scope.document_id ?? (res.scope.product_id ? productName[res.scope.product_id] : "all products")}
                {" · "}{res.scope.states?.join(", ") ?? "all states"}
                {" · "}{res.scope.edition ? `edition ${res.scope.edition}` : res.scope.editions === "all" ? "all editions" : "current editions"}
                {" · "}searched {res.coverage.documents_indexed} of {res.coverage.documents_in_scope} guides
              </p>
              {res.coverage.not_indexed.length > 0 && (
                <p role="status" className="mt-2 rounded-lg bg-amber/30 p-3 text-sm">
                  {res.coverage.not_indexed.length} guide(s) in scope are not indexed and were not searched:{" "}
                  {res.coverage.not_indexed.slice(0, 5).map((d) => d.document_id).join(", ")}
                  {res.coverage.not_indexed.length > 5 ? "…" : ""}
                </p>
              )}
              <ol className="mt-4 space-y-3">
                {res.results.map((h, i) => (
                  <li key={h.chunk_id} id={`chunk-${h.chunk_id}`} className="card scroll-mt-24 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <Link href={`/guides/${h.document_id}#s-${h.section_id}`} className="font-semibold underline">
                        {productName[h.product_id]} · {stateName[h.state]} · Edition {h.edition_number}
                      </Link>
                      <span className="muted">
                        [{i + 1}] {h.section_title} · p. {h.page_start}{h.page_end > h.page_start ? `–${h.page_end}` : ""}
                        {h.is_current ? "" : " · historical"}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm">{h.text.length > 600 ? `${h.text.slice(0, 600)}…` : h.text}</p>
                    <p className="mt-2 break-all text-xs muted">
                      {h.document_id} · {h.kind}
                      {h.lexical_rank ? ` · lexical #${h.lexical_rank}` : ""}
                      {h.vector_rank ? ` · vector #${h.vector_rank}` : ""}
                      {h.fact_ids.length ? ` · facts ${h.fact_ids.join(", ")}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
              {res.results.length === 0 && <p className="mt-4 muted">No passages in this scope matched. Nothing outside the scope was searched.</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
