import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { getDocument } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Website-like guide view: semantic GuideBlocks, not a PDF transcript.
// Synthetic demo content — not an insurance contract or coverage advice.

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

export default async function GuideView({ params }: { params: { documentId: string } }) {
  const r = await getDocument(params.documentId);
  if (!r) notFound();
  const { doc, lineage } = r;
  const { rows: blocks } = await pool.query<Block>(
    `SELECT block_id, section_id, section_title, sort_order, kind, content, fact_ids, page_start, page_end
     FROM guide_blocks WHERE document_id = $1 ORDER BY sort_order`,
    [doc.document_id],
  );
  const pdf = await pool.query<{ artifact_id: string }>(
    "SELECT artifact_id FROM artifacts WHERE edition_id = $1 AND format = 'pdf' ORDER BY role LIMIT 1",
    [doc.edition_id],
  );
  const sections = blocks.filter((b) => b.kind === "heading");

  if (!blocks.length) {
    return (
      <div className="container-page py-10">
        <h1 className="font-serif text-3xl">{doc.display_name} — {doc.state_name}</h1>
        <p className="mt-4 muted">Structured guide view is not built for this document yet.</p>
        <p className="mt-2"><Link className="link" href={`/guides/${doc.document_id}`}>Back to guide</Link></p>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="text-sm muted">
        <Link href="/library" className="link">Library</Link> / <Link href={`/guides/${doc.document_id}`} className="link">{doc.document_id}</Link> / Guide
      </nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">{doc.display_name}</h1>
          <p className="mt-1 text-sm muted">
            {doc.state_name} · Edition {doc.edition_number} ({doc.effective_date}) · rev {doc.revision}
          </p>
        </div>
        {pdf.rows[0] && (
          <a href={`/api/artifacts/${pdf.rows[0].artifact_id}`} className="btn-primary">View source PDF</a>
        )}
      </div>

      {lineage.length > 1 && (
        <p className="mt-3 text-sm muted">
          Also available:{" "}
          {lineage.filter((e) => e.document_id !== doc.document_id).map((e) => (
            <Link key={e.document_id} className="link mr-3" href={`/guides/${e.document_id}/guide`}>
              Edition {e.edition_number}
            </Link>
          ))}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="card h-fit max-h-[80vh] overflow-auto p-4 text-sm lg:sticky lg:top-4">
          <p className="font-semibold">Contents</p>
          <ul className="mt-2 space-y-1">
            {sections.map((s) => (
              <li key={s.block_id}>
                <a href={`#${s.block_id}`} className="link">{s.content.number} {s.content.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 space-y-4">
          {blocks.map((b) => {
            if (b.kind === "heading") {
              return (
                <h2 key={b.block_id} id={b.block_id} className="scroll-mt-24 border-b pb-2 pt-4 font-serif text-2xl" style={{ borderColor: "var(--border)" }}>
                  {b.content.number} {b.content.title}
                </h2>
              );
            }
            if (b.kind === "term") {
              return (
                <div key={b.block_id} className="card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{b.content.topic}</h3>
                    {b.page_start != null && (
                      <span className="text-xs muted" title="Source page in the immutable PDF">
                        source p. {b.page_start}{b.page_end != null && b.page_end > b.page_start ? `–${b.page_end}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{b.content.statement}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {b.content.overridden && (
                      <span className="rounded bg-amber/60 px-2 py-0.5 font-medium text-navy">State override</span>
                    )}
                    {(b.content.footnotes as string[] | undefined)?.map((f, i) => (
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
                    {b.page_start != null && <span className="text-xs muted">source p. {b.page_start}–{b.page_end}</span>}
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
          <p className="pt-4 text-xs muted">Synthetic demo content — not an insurance contract or coverage advice. Every term cites its page in the immutable source PDF.</p>
        </article>
      </div>
    </div>
  );
}
