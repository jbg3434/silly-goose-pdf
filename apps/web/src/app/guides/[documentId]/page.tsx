import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/DocumentCard";
import { pool } from "@/lib/db";
import { formatFactValue, getDocument, getGuideDetails } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { documentId: string } }) {
  const r = await getDocument(params.documentId);
  return { title: r ? `${r.doc.display_name} — ${r.doc.state_name}, edition ${r.doc.edition_number}` : "Guide not found" };
}

type Block = {
  block_id: string; section_id: string; section_title: string; sort_order: number;
  kind: string;
  content: {
    number?: string; title?: string; topic?: string; statement?: string;
    overridden?: boolean; footnotes?: string[];
    caption?: string; columns?: string[]; rows?: string[][];
  };
  fact_ids: string[]; page_start: number | null; page_end: number | null;
};

function pageRef(b: Block) {
  if (b.page_start == null) return null;
  return `source p. ${b.page_start}${b.page_end != null && b.page_end > b.page_start ? `–${b.page_end}` : ""}`;
}

export default async function Guide({ params }: { params: { documentId: string } }) {
  const r = await getDocument(params.documentId);
  if (!r) notFound();
  const { doc, lineage } = r;
  const details = await getGuideDetails(doc.edition_id, doc.product_id, doc.state, doc.edition_number);
  const pdf = details.artifacts.find((a) => a.format === "pdf");
  const { rows: blocks } = await pool.query<Block>(
    `SELECT block_id, section_id, section_title, sort_order, kind, content, fact_ids, page_start, page_end
     FROM guide_blocks WHERE document_id = $1 ORDER BY sort_order`,
    [doc.document_id],
  );
  const sections = blocks.filter((b) => b.kind === "heading");
  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="text-sm muted">
        <Link href="/products" className="link">Products</Link>
        {" / "}
        <Link href={`/products/${doc.product_id}`} className="link">{doc.family}</Link>
        {" / "}
        {doc.state_name}
      </nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl">
            {doc.display_name} — {doc.state_name}
          </h1>
          <p className="mt-1 muted">
            Edition {doc.edition_number} · Revision {doc.revision} · Effective {doc.effective_date} · {doc.document_id}
          </p>
          {lineage.length > 1 && (
            <p className="mt-1 text-sm muted">
              Other editions:{" "}
              {lineage.filter((e) => e.document_id !== doc.document_id).map((e) => (
                <Link key={e.document_id} className="link mr-3" href={`/guides/${e.document_id}`}>
                  Edition {e.edition_number}
                </Link>
              ))}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pdf && <a href={`/api/artifacts/${pdf.artifact_id}`} className="btn-primary">View source PDF</a>}
          <span className="badge-synthetic">Synthetic</span>
          <StatusPill state={doc.publication_state} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {sections.length > 0 ? (
            <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
              <nav aria-label="Sections" className="card h-fit max-h-[70vh] overflow-auto p-4 text-sm xl:sticky xl:top-4">
                <p className="font-semibold">Contents</p>
                <ul className="mt-2 space-y-1">
                  {sections.map((s) => (
                    <li key={s.block_id}>
                      <a href={`#s-${s.section_id}`} className="link">{s.content.number} {s.content.title}</a>
                    </li>
                  ))}
                </ul>
              </nav>
              <article className="min-w-0 space-y-4">
                {blocks.map((b) => {
                  if (b.kind === "heading") {
                    return (
                      <h2 key={b.block_id} id={`s-${b.section_id}`} className="scroll-mt-24 border-b pb-2 pt-4 font-serif text-2xl" style={{ borderColor: "var(--border)" }}>
                        {b.content.number} {b.content.title}
                      </h2>
                    );
                  }
                  if (b.kind === "term") {
                    return (
                      <div key={b.block_id} className="card p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-semibold">{b.content.topic}</h3>
                          {pageRef(b) && (
                            <span className="text-xs muted" title="Source page in the immutable PDF">{pageRef(b)}</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed">{b.content.statement}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {b.content.overridden && (
                            <span className="rounded bg-amber/60 px-2 py-0.5 font-medium text-navy">State override</span>
                          )}
                          {b.content.footnotes?.map((f, i) => (
                            <span key={i} className="rounded border px-2 py-0.5 muted" style={{ borderColor: "var(--border)" }}>{f}</span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (b.kind === "table") {
                    return (
                      <div key={b.block_id} className="card overflow-x-auto p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-semibold">{b.content.caption}</h3>
                          {pageRef(b) && <span className="text-xs muted">{pageRef(b)}</span>}
                        </div>
                        <table className="mt-2 w-full text-sm">
                          <thead>
                            <tr className="border-b text-left" style={{ borderColor: "var(--border)" }}>
                              {b.content.columns?.map((c) => <th key={c} className="py-1 pr-4 font-semibold">{c}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {b.content.rows?.map((row, i) => (
                              <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                                {row.map((cell, j) => (
                                  <td key={j} className={`py-1.5 pr-4 ${row[2] !== "baseline" && j === 1 ? "font-medium text-teal-700" : ""}`}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }
                  return null;
                })}
              </article>
            </div>
          ) : (
            <section className="card p-6" aria-labelledby="no-guide-h">
              <h2 id="no-guide-h" className="font-serif text-2xl">Structured view not built yet</h2>
              <p className="mt-2 text-sm muted">
                Run <code>pnpm --filter web blocks:build</code> to derive guide blocks for this document.
                {pdf && <> The <a className="link" href={`/api/artifacts/${pdf.artifact_id}`}>source PDF</a> is available meanwhile.</>}
              </p>
            </section>
          )}

          {details.differences.length > 0 && (
            <section className="card mt-6 p-4" aria-labelledby="diff-h">
              <h2 id="diff-h" className="font-semibold">
                {doc.state_name} differences from the {doc.family} baseline
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="muted">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Term</th>
                      <th className="py-1 pr-3 font-medium">Baseline</th>
                      <th className="py-1 pr-3 font-medium">This guide</th>
                      <th className="py-1 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.differences.map((d) => (
                      <tr key={d.topic} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="py-1.5 pr-3">
                          {d.topic}
                          <span className="block text-xs muted">{d.section_title}</span>
                        </td>
                        <td className="py-1.5 pr-3">{formatFactValue(d.baseline, d.unit)}</td>
                        <td className="py-1.5 pr-3 font-medium">
                          {formatFactValue(d.replacement_value, d.unit)}
                          {d.edition === 2 && <span className="ml-1 text-xs text-teal">(edition 2)</span>}
                        </td>
                        <td className="py-1.5 text-xs muted">
                          {d.reason_code.replace(/_/g, " ").toLowerCase()}
                          {d.regulation_rule_id && <span className="block">Synthetic rule {d.regulation_rule_id}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs muted">Rule references are fictional synthetic-demo rules, not real regulations.</p>
            </section>
          )}
        </div>

        <aside aria-labelledby="lineage-h" className="min-w-0 space-y-4">
          <div className="card h-fit p-4">
            <h2 className="font-semibold">Ask this guide</h2>
            <p className="mt-1 text-xs muted">Cited answers are limited to this guide.</p>
            <Link href={`/search?document=${doc.document_id}`} className="btn-primary mt-3 block text-center">
              Search or ask
            </Link>
            <form action={`/guides/${doc.document_id}/read`} className="mt-3">
              <label htmlFor="find" className="text-xs font-semibold">Find in this guide</label>
              <div className="mt-1 flex gap-1">
                <input id="find" name="find" className="field min-w-0 flex-1 text-sm" placeholder="e.g. $500,000" />
                <button className="btn-secondary text-sm">Find</button>
              </div>
            </form>
          </div>
          <div className="card h-fit min-w-0 p-4">
          <h2 id="lineage-h" className="font-semibold">
            Version lineage
          </h2>
          <ol className="mt-3 space-y-3">
            {lineage.map((e) => (
              <li key={e.document_id} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between gap-2">
                  {e.document_id === doc.document_id ? (
                    <span className="font-semibold">Edition {e.edition_number} (viewing)</span>
                  ) : (
                    <Link href={`/guides/${e.document_id}`} className="link font-semibold">
                      Edition {e.edition_number}
                    </Link>
                  )}
                  <StatusPill state={e.publication_state} />
                </div>
                <p className="mt-1 muted">
                  Effective {e.effective_date} · {e.source_format === "legacy-pdf" ? "Legacy PDF" : "ODT source"} · Approval:{" "}
                  {e.approval_state.replace(/_/g, " ")}
                </p>
              </li>
            ))}
          </ol>
          {doc.change_summary && (
            <>
              <h2 className="mt-6 font-semibold">What changed in this edition</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {doc.change_summary.split("; ").map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {details.artifacts.length > 0 && (
            <>
              <Link href={`/guides/${doc.document_id}/revisions`} className="btn-secondary mt-6 w-full">
                Revisions and simulated approvals
              </Link>
              <h2 className="mt-6 font-semibold">Source files</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {details.artifacts.map((a) => (
                  <li key={a.artifact_id}>
                    <a className="link font-medium" href={`/api/artifacts/${a.artifact_id}`}>
                      {a.format.toUpperCase()}
                    </a>{" "}
                    <span className="muted">
                      · {a.role.replace(/-/g, " ")} · {(a.byte_size / 1024).toFixed(0)} KB
                    </span>
                    <code className="block truncate text-xs muted" title={a.sha256}>
                      {a.sha256}
                    </code>
                  </li>
                ))}
              </ul>
            </>
          )}
          {details.approvals.length > 0 && (
            <>
              <h2 className="mt-6 font-semibold">Approval history</h2>
              <p className="text-xs muted">Simulated DOI workflow. No real filing was made.</p>
              <ol className="mt-2 space-y-2 border-l pl-3 text-sm" style={{ borderColor: "var(--border)" }}>
                {details.approvals.map((e) => (
                  <li key={`${e.stage}-${e.timestamp}`}>
                    <span className="font-medium capitalize">{e.stage.replace(/_/g, " ")}</span>{" "}
                    <span className="muted">· {e.timestamp}</span>
                    <span className="block text-xs muted">{e.actor}</span>
                    {e.simulated_receipt_id && <span className="block text-xs">Receipt {e.simulated_receipt_id}</span>}
                  </li>
                ))}
              </ol>
            </>
          )}
          </div>
        </aside>
      </div>
    </div>
  );
}
