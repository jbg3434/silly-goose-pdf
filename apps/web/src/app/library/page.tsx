import Link from "next/link";
import { DocumentCard } from "@/components/DocumentCard";
import { Gus } from "@/components/gus/Gus";
import { listDocuments, listProducts, listStates, SORTS, type LibraryFilters, type SortKey } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Library" };

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : v.split(",")).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

const EDITIONS = { current: "Current published only", all: "All editions", "1": "Edition 1 (legacy)", "2": "Edition 2" } as const;
const FORMATS = { "legacy-pdf": "Legacy PDF", odt: "ODT (editable)" } as const;
const APPROVALS = ["draft", "internal_review", "ready_for_filing", "submitted", "approved", "rejected", "withdrawn"];
const STATUSES = ["published", "superseded", "unpublished"];
const SORT_LABELS: Record<SortKey, string> = {
  product: "Product, then state",
  state: "State, then product",
  effective_desc: "Effective date (newest)",
  effective_asc: "Effective date (oldest)",
};

export default async function Library({ searchParams }: { searchParams: SP }) {
  const [products, states] = await Promise.all([listProducts(), listStates()]);
  const productIds = new Set(products.map((p) => p.id));
  const stateCodes = new Set(states.map((s) => s.code));
  const ed = one(searchParams.edition);
  const sort = one(searchParams.sort);
  const filters: LibraryFilters = {
    q: one(searchParams.q)?.slice(0, 100),
    product: arr(searchParams.product).filter((p) => productIds.has(p)),
    state: arr(searchParams.state).map((s) => s.toUpperCase()).filter((s) => stateCodes.has(s)),
    edition: ed && ed in EDITIONS ? (ed as LibraryFilters["edition"]) : "current",
    format: one(searchParams.format) && one(searchParams.format)! in FORMATS ? one(searchParams.format) : undefined,
    approval: APPROVALS.includes(one(searchParams.approval) ?? "") ? one(searchParams.approval) : undefined,
    status: STATUSES.includes(one(searchParams.status) ?? "") ? one(searchParams.status) : undefined,
    sort: sort && sort in SORTS ? (sort as SortKey) : "product",
    page: Math.max(1, Number(one(searchParams.page)) || 1),
  };
  const { rows, total, page, pageSize } = await listDocuments(filters);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      q: filters.q,
      product: filters.product?.join(","),
      state: filters.state?.join(","),
      edition: filters.edition === "current" ? undefined : filters.edition,
      format: filters.format,
      approval: filters.approval,
      status: filters.status,
      sort: filters.sort === "product" ? undefined : filters.sort,
      page: page > 1 ? String(page) : undefined,
      ...patch,
    };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/library?${s}` : "/library";
  };

  return (
    <div className="container-page py-10">
      <h1 className="font-serif text-4xl">Guide library</h1>
      <p className="mt-2 muted">Browse every synthetic product guide by product, state, edition, source format, and status.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <form action="/library" className="card h-fit space-y-4 p-4" aria-label="Library filters">
          <div>
            <label htmlFor="q" className="block text-sm font-semibold">
              Search
            </label>
            <input id="q" name="q" defaultValue={filters.q} className="field mt-1 w-full" placeholder="Product, state, or document ID" />
          </div>
          <fieldset>
            <legend className="text-sm font-semibold">Product</legend>
            <div className="mt-1 max-h-48 space-y-1 overflow-auto pr-1">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="product" value={p.id} defaultChecked={filters.product?.includes(p.id)} />
                  {p.family}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="state" className="block text-sm font-semibold">
              States
            </label>
            <select id="state" name="state" multiple defaultValue={filters.state} className="field mt-1 h-32 w-full">
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs muted">Hold Ctrl/Cmd to choose several.</p>
          </div>
          <Select id="edition" label="Edition" value={filters.edition} options={EDITIONS} />
          <Select id="format" label="Source format" value={filters.format} options={FORMATS} any />
          <Select id="approval" label="Approval state" value={filters.approval} options={Object.fromEntries(APPROVALS.map((a) => [a, a.replace(/_/g, " ")]))} any />
          <Select id="status" label="Document status" value={filters.status} options={Object.fromEntries(STATUSES.map((s) => [s, s]))} any />
          <Select id="sort" label="Sort by" value={filters.sort} options={SORT_LABELS} />
          <div className="flex gap-2">
            <button className="btn-primary flex-1">Apply filters</button>
            <Link href="/library" className="btn-secondary">
              Reset
            </Link>
          </div>
        </form>

        <section aria-labelledby="results-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="results-h" className="text-lg font-semibold" aria-live="polite">
              {total.toLocaleString()} {total === 1 ? "guide" : "guides"}
              <span className="ml-2 text-sm font-normal muted">
                {EDITIONS[filters.edition ?? "current"]}
                {filters.state?.length ? ` · ${filters.state.join(", ")}` : ""}
              </span>
            </h2>
            {total > 0 && (
              <p className="text-sm muted">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
              </p>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="card mt-4 flex flex-col items-center gap-3 p-10 text-center">
              <Gus pose="sideeye" size={120} decorative />
              <p className="font-serif text-xl">No guides match those filters.</p>
              <p className="text-sm muted">Gus looked under every lily pad. Try removing a filter.</p>
              <Link href="/library" className="btn-secondary">
                Clear all filters
              </Link>
            </div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((d) => (
                <DocumentCard key={d.document_id} d={d} />
              ))}
            </ul>
          )}
          {pages > 1 && (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              {page > 1 ? (
                <Link className="btn-secondary" href={qs({ page: String(page - 1) })}>
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm muted">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Link className="btn-secondary" href={qs({ page: String(page + 1) })}>
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}

function Select({ id, label, value, options, any }: { id: string; label: string; value?: string; options: Record<string, string>; any?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <select id={id} name={id} defaultValue={value ?? ""} className="field mt-1 w-full">
        {any && <option value="">Any</option>}
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k} className="capitalize">
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}
