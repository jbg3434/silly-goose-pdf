import Link from "next/link";
import type { DocumentRow } from "@/lib/queries";

export function StatusPill({ state }: { state: string }) {
  const styles: Record<string, string> = {
    published: "bg-teal-100 text-teal-700",
    superseded: "bg-ivory-300 text-slate",
    unpublished: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${styles[state] ?? "bg-ivory-300 text-navy"}`}>
      {state === "published" ? "Current" : state}
    </span>
  );
}

export function DocumentCard({ d }: { d: DocumentRow }) {
  return (
    <li className="card relative flex flex-col p-4 transition-shadow focus-within:shadow-md hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide muted">{d.family}</p>
        <span className="badge-synthetic">Synthetic</span>
      </div>
      <h3 className="mt-1 font-serif text-lg leading-snug">
        <Link href={`/guides/${d.document_id}`} className="after:absolute after:inset-0 hover:underline">
          {d.display_name} — {d.state_name}
        </Link>
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="muted">Edition</dt>
        <dd>
          {d.edition_number} ({d.effective_date})
        </dd>
        <dt className="muted">Revision</dt>
        <dd>{d.revision}</dd>
        <dt className="muted">Source</dt>
        <dd>{d.source_format === "legacy-pdf" ? "Legacy PDF" : "ODT (editable)"}</dd>
        <dt className="muted">Pages</dt>
        <dd>{d.page_count ?? "Not generated yet"}</dd>
      </dl>
      <div className="mt-3 flex items-center gap-2">
        <StatusPill state={d.publication_state} />
        <span className="text-xs muted">{d.document_id}</span>
      </div>
    </li>
  );
}
