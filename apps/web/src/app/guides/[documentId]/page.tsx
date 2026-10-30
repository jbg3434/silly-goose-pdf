import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/DocumentCard";
import { Gus } from "@/components/gus/Gus";
import { getDocument } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { documentId: string } }) {
  const r = await getDocument(params.documentId);
  return { title: r ? `${r.doc.display_name} — ${r.doc.state_name}, edition ${r.doc.edition_number}` : "Guide not found" };
}

export default async function Guide({ params }: { params: { documentId: string } }) {
  const r = await getDocument(params.documentId);
  if (!r) notFound();
  const { doc, lineage } = r;
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card flex flex-col items-center gap-4 p-10 text-center" aria-labelledby="reader-h">
          <Gus pose="sleepy" size={130} decorative />
          <h2 id="reader-h" className="font-serif text-2xl">
            This guide has not been generated yet
          </h2>
          <p className="max-w-lg text-sm muted">
            The catalog record and edition lineage exist, but the PDF, editable source, and reading view are produced by the corpus
            build. Until then there is nothing to read, search, or cite for this guide, and it is excluded from any coverage claims.
          </p>
        </section>

        <aside aria-labelledby="lineage-h" className="card h-fit p-4">
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
        </aside>
      </div>
    </div>
  );
}
