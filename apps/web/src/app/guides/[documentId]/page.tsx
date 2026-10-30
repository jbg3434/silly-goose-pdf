import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/DocumentCard";
import { Gus } from "@/components/gus/Gus";
import { formatFactValue, getDocument, getGuideDetails } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { documentId: string } }) {
  const r = await getDocument(params.documentId);
  return { title: r ? `${r.doc.display_name} — ${r.doc.state_name}, edition ${r.doc.edition_number}` : "Guide not found" };
}

export default async function Guide({ params }: { params: { documentId: string } }) {
  const r = await getDocument(params.documentId);
  if (!r) notFound();
  const { doc, lineage } = r;
  const details = await getGuideDetails(doc.edition_id, doc.product_id, doc.state, doc.edition_number);
  const pdf = details.artifacts.find((a) => a.format === "pdf");
  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="text-sm muted">
        <Link href="/library" className="link">
          Library
        </Link>{" "}
        /{" "}
        <Link href={`/library?product=${doc.product_id}`} className="link">
          {doc.family}
        </Link>{" "}
        / {doc.state_name}
      </nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl">
            {doc.display_name} — {doc.state_name}
          </h1>
          <p className="mt-1 muted">
            Edition {doc.edition_number} · Revision {doc.revision} · Effective {doc.effective_date} · {doc.document_id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-synthetic">Synthetic</span>
          <StatusPill state={doc.publication_state} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {pdf ? (
            <section className="card overflow-hidden" aria-labelledby="reader-h">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h2 id="reader-h" className="font-semibold">
                    Published PDF · {doc.page_count} pages
                  </h2>
                  <p className="text-xs muted">
                    {doc.edition_number === 1 ? "Immutable inbound legacy PDF" : "Rendered from the approved ODT source"} · SHA-256{" "}
                    <code>{pdf.sha256.slice(0, 16)}…</code>
                  </p>
                </div>
                <a className="btn btn-secondary" href={`/api/artifacts/${pdf.artifact_id}`}>
                  Download PDF
                </a>
              </div>
              {details.imageOnlyPages.length > 0 && (
                <p className="bg-ivory-200 px-4 py-2 text-xs dark:bg-navy-700" role="note">
                  Pages {details.imageOnlyPages.join(" and ")} are scanned images with no text layer. They are flagged for OCR
                  with low extraction confidence.
                </p>
              )}
              <iframe
                title={`${doc.display_name} ${doc.state_name} edition ${doc.edition_number} PDF`}
                src={`/api/artifacts/${pdf.artifact_id}?inline=1`}
                className="h-[75vh] w-full bg-white"
              />
            </section>
          ) : (
            <section className="card flex flex-col items-center gap-4 p-10 text-center" aria-labelledby="reader-h">
              <Gus pose="sleepy" size={130} decorative />
              <h2 id="reader-h" className="font-serif text-2xl">
                This guide has not been generated yet
              </h2>
              <p className="max-w-lg text-sm muted">
                Run the corpus build and load it to create this guide. Until then it is excluded from search and coverage claims.
              </p>
            </section>
          )}

          {details.differences.length > 0 && (
            <section className="card p-4" aria-labelledby="diff-h">
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

        <aside aria-labelledby="lineage-h" className="card h-fit min-w-0 p-4">
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
        </aside>
      </div>
    </div>
  );
}
