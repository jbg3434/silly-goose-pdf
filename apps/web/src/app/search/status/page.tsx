import Link from "next/link";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Index status" };

type Row = { state: string; n: number };
type Problem = { document_id: string; state: string; error: string | null; flags: unknown[]; ocr_pages: number[]; min_ocr_confidence: number | null };

export default async function IndexStatus() {
  const [counts, versions, problems, ocr, runs] = await Promise.all([
    pool.query<Row>("SELECT state::text, count(*)::int AS n FROM index_status GROUP BY state ORDER BY state"),
    pool.query<{ extraction_version: string; chunking_version: string; embedding_model: string; n: number; chunks: number }>(
      `SELECT extraction_version, chunking_version, embedding_model, count(*)::int AS n, sum(chunk_count)::int AS chunks
       FROM index_status WHERE state = 'indexed' GROUP BY 1, 2, 3`,
    ),
    pool.query<Problem>(
      `SELECT document_id, state::text, error, flags, ocr_pages, min_ocr_confidence FROM index_status
       WHERE state <> 'indexed' OR jsonb_array_length(flags) > 0 ORDER BY document_id LIMIT 100`,
    ),
    pool.query<{ n: number; pages: number; min: number | null }>(
      "SELECT count(*)::int AS n, coalesce(sum(cardinality(ocr_pages)), 0)::int AS pages, min(min_ocr_confidence) AS min FROM index_status WHERE cardinality(ocr_pages) > 0",
    ),
    pool.query<{ query: string; mode: string; latency_ms: number; result_count: number; documents_considered: number; created_at: Date }>(
      "SELECT query, mode, latency_ms, result_count, documents_considered, created_at FROM search_runs ORDER BY created_at DESC LIMIT 10",
    ),
  ]);
  const total = counts.rows.reduce((a, r) => a + r.n, 0);
  return (
    <div className="container-page py-10">
      <h1 className="font-serif text-4xl">Index status</h1>
      <p className="mt-2 muted">
        Guides that are not indexed are excluded from search and reported in each result&apos;s coverage. <Link href="/search" className="underline">Back to search</Link>
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["indexed", "queued", "processing", "failed"].map((s) => (
          <div key={s} className="card p-4">
            <dt className="text-sm muted capitalize">{s}</dt>
            <dd className="mt-1 text-3xl font-semibold" data-testid={`count-${s}`}>
              {counts.rows.find((r) => r.state === s)?.n ?? 0}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm muted">{total} guides tracked.</p>

      <h2 className="mt-10 text-xl font-semibold">Pipeline versions</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th className="py-1 pr-4">Extraction</th><th className="pr-4">Chunking</th><th className="pr-4">Embedding model</th><th className="pr-4">Guides</th><th>Chunks</th></tr></thead>
          <tbody>
            {versions.rows.map((v) => (
              <tr key={`${v.extraction_version}${v.chunking_version}${v.embedding_model}`} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="py-1 pr-4">{v.extraction_version}</td><td className="pr-4">{v.chunking_version}</td><td className="pr-4">{v.embedding_model}</td>
                <td className="pr-4">{v.n}</td><td>{v.chunks.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm">
        OCR: {ocr.rows[0].pages} image-only pages in {ocr.rows[0].n} legacy guides
        {ocr.rows[0].min !== null ? `, lowest mean page confidence ${(ocr.rows[0].min * 100).toFixed(0)}%` : ""}.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Failures and extraction flags</h2>
      {problems.rows.length === 0 ? (
        <p className="mt-2 muted">None.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {problems.rows.map((p) => (
            <li key={p.document_id} className="card break-words p-3">
              <Link href={`/guides/${p.document_id}`} className="font-semibold underline">{p.document_id}</Link> · {p.state}
              {p.error ? ` · ${p.error}` : ""}
              {p.flags.length ? ` · ${p.flags.length} flag(s): ${JSON.stringify(p.flags[0])}` : ""}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-xl font-semibold">Recent searches</h2>
      <ul className="mt-3 space-y-1 text-sm">
        {runs.rows.map((r) => (
          <li key={r.created_at.toISOString() + r.query} className="break-words">
            “{r.query}” · {r.mode} · {r.result_count} results from {r.documents_considered} guides · {r.latency_ms} ms
          </li>
        ))}
      </ul>
    </div>
  );
}
