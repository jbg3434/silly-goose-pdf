import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { getDocument } from "@/lib/queries";

export const dynamic = "force-dynamic";

type ChunkRow = {
  chunk_id: string; section_id: string; section_title: string; kind: string; text: string;
  page_start: number; page_end: number; confidence: number; fact_ids: string[];
};

export default async function GuideReader({ params, searchParams }: { params: { documentId: string }; searchParams: { find?: string } }) {
  const r = await getDocument(params.documentId);
  if (!r) notFound();
  const { doc } = r;
  const { rows } = await pool.query<ChunkRow>(
    `SELECT c.chunk_id, c.section_id, c.section_title, c.kind, c.text, c.page_start, c.page_end, c.confidence, c.fact_ids
     FROM chunks c JOIN index_status i ON i.document_id = c.document_id AND i.state = 'indexed' AND i.artifact_sha256 = c.artifact_sha256
     WHERE c.document_id = $1 ORDER BY c.page_start, c.chunk_id`,
    [doc.document_id],
  );
  const find = (searchParams.find ?? "").trim().toLowerCase();
  const matchIds = find ? new Set(rows.filter((c) => c.text.toLowerCase().includes(find)).map((c) => c.chunk_id)) : null;
  const sections = Array.from(new Map(rows.map((c) => [c.section_id, c.section_title])));

  if (!rows.length) {
    return (
      <div className="container-page py-10">
        <h1 className="font-serif text-3xl">{doc.display_name} — {doc.state_name}</h1>
        <p className="mt-4 muted">This guide is not indexed yet, so there is no text reader. Open the PDF on the <Link className="link" href={`/guides/${doc.document_id}`}>guide page</Link>.</p>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="text-sm muted">
        <Link href={`/guides/${doc.document_id}`} className="link">{doc.display_name} — {doc.state_name}</Link> / Text reader
      </nav>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-serif text-3xl">
          {doc.display_name} — {doc.state_name}
        </h1>
        <p className="text-sm muted">Edition {doc.edition_number} · {rows.length} passages · synthetic demo content</p>
      </div>
      <form className="card mt-6 flex flex-wrap items-end gap-3 p-4" aria-label="Find in this guide">
        <div className="min-w-48 flex-1">
          <label htmlFor="find" className="block text-sm font-semibold">Find in this guide</label>
          <input id="find" name="find" defaultValue={searchParams.find ?? ""} className="field mt-1 w-full" placeholder="e.g. deductible, $500,000" />
        </div>
        <button className="btn-primary">Find</button>
        {find && (
          <p className="w-full text-sm muted" role="status">
            {matchIds?.size ?? 0} matching {matchIds?.size === 1 ? "passage" : "passages"} (highlighted)
          </p>
        )}
      </form>
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="card h-fit max-h-[80vh] overflow-auto p-4 text-sm">
          <p className="font-semibold">Sections</p>
          <ul className="mt-2 space-y-1">
            {sections.map(([id, title]) => (
              <li key={id}>
                <a href={`#sec-${id}`} className="link">{title}</a>
              </li>
            ))}
          </ul>
        </nav>
        <article className="min-w-0 space-y-1">
          {rows.map((c, i) => {
            const isMatch = matchIds?.has(c.chunk_id);
            const newSection = i === 0 || rows[i - 1].section_id !== c.section_id;
            return (
              <div key={c.chunk_id}>
                {newSection && (
                  <h2 id={`sec-${c.section_id}`} className="mt-6 scroll-mt-24 font-serif text-2xl">
                    {c.section_title}
                  </h2>
                )}
                <p
                  id={c.chunk_id}
                  className={`scroll-mt-24 whitespace-pre-wrap break-all rounded-lg p-3 text-sm leading-relaxed ${isMatch ? "bg-amber/40 outline outline-1 outline-amber" : "card"}`}
                >
                  <span className="mr-2 select-none align-top text-xs muted">p. {c.page_start}{c.page_end > c.page_start ? `–${c.page_end}` : ""}</span>
                  {c.text}
                  {c.confidence < 1 && <span className="ml-2 text-xs muted">(OCR, confidence {Math.round(c.confidence * 100)}%)</span>}
                </p>
              </div>
            );
          })}
        </article>
      </div>
    </div>
  );
}
