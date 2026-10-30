import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleSwitcher, TransitionButtons, UploadForm } from "@/components/workflow/WorkflowControls";
import { currentActor } from "@/lib/actor";
import { pool } from "@/lib/db";
import { getDocument } from "@/lib/queries";
import { TRANSITIONS } from "@/lib/revisions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revisions and simulated approvals" };

type Change = { fact_id: string; topic: string; before: string | null; after: string | null; kind: string };
type Diff = {
  term_changes?: Change[];
  sections_inserted?: string[];
  sections_deleted?: string[];
  table_cell_changes?: { table: number; row: number; col: number; before: string; after: string }[];
  footnote_changes?: { before: string | null; after: string | null }[];
  unresolved?: { topic: string; issue: string }[];
  formatting_only?: boolean;
  visual?: { changed_pages: number[]; pages: { page: number; image: string | null; ratio: number }[] };
};
type Rev = {
  revision_id: string; target_edition: number; parent_revision_id: string | null; status: string; created_by: string; created_at: string;
  source_format: string; source_artifact_id: string; canonical_odt_artifact_id: string; pdf_artifact_id: string; odt_sha: string;
  approved_sha256: string | null; published_edition_id: string | null; diff: Diff; conversion_report: { items?: { severity: string; issue: string }[] };
  has_child: boolean;
};
type Ev = { revision_id: string; stage: string; actor: string; role: string | null; timestamp: string; notes: string | null; artifact_sha256: string; simulated_receipt_id: string | null };

const LABEL: Record<string, string> = {
  draft: "Draft", internal_review: "Internal review", ready_for_filing: "Ready for filing", submitted: "Submitted (simulated)",
  approved: "Approved (simulated)", rejected: "Rejected", withdrawn: "Withdrawn", published: "Published",
};

export default async function Revisions({ params }: { params: { documentId: string } }) {
  const r = await getDocument(params.documentId);
  if (!r) notFound();
  const { doc } = r;
  const { lineage_id } = (await pool.query<{ lineage_id: string }>("SELECT lineage_id FROM editions WHERE edition_id = $1", [doc.edition_id])).rows[0];
  const current = (
    await pool.query<{ document_id: string; edition_number: number; odt_id: string | null }>(
      `SELECT d.document_id, e.edition_number,
         (SELECT a.artifact_id FROM artifacts a WHERE a.edition_id = e.edition_id AND a.format = 'odt' ORDER BY a.uploaded_at DESC LIMIT 1) AS odt_id
       FROM editions e JOIN documents d ON d.edition_id = e.edition_id WHERE e.lineage_id = $1 AND e.publication_state = 'published' AND e.current_to IS NULL`,
      [lineage_id],
    )
  ).rows[0];
  const revs = (
    await pool.query<Rev>(
      `SELECT r.*, to_char(r.created_at, 'YYYY-MM-DD HH24:MI') AS created_at, a.sha256 AS odt_sha,
         EXISTS (SELECT 1 FROM revisions c WHERE c.parent_revision_id = r.revision_id) AS has_child
       FROM revisions r JOIN artifacts a ON a.artifact_id = r.canonical_odt_artifact_id WHERE r.lineage_id = $1 ORDER BY r.created_at DESC`,
      [lineage_id],
    )
  ).rows;
  const events = (
    await pool.query<Ev>(
      `SELECT revision_id, stage, actor, role, to_char(timestamp, 'YYYY-MM-DD HH24:MI') AS timestamp, notes, artifact_sha256, simulated_receipt_id
       FROM approval_events WHERE revision_id = ANY($1) ORDER BY event_id`,
      [revs.map((x) => x.revision_id)],
    )
  ).rows;
  const { role, actor } = currentActor();

  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="text-sm muted">
        <Link href="/library" className="link">Library</Link> /{" "}
        <Link href={`/guides/${current?.document_id ?? doc.document_id}`} className="link">{doc.display_name} — {doc.state_name}</Link> / Revisions
      </nav>
      <h1 className="mt-3 font-serif text-3xl md:text-4xl">Revisions and simulated approvals</h1>
      <p className="mt-2 max-w-3xl muted">
        Upload an edited ODT or DOCX to create an immutable draft revision. Each draft is compared with the current edition, then moves through a
        simulated review and filing workflow. Only the exact approved file can be published. No real regulator is involved.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {revs.length === 0 && <p className="card p-4 muted">No draft revisions yet for this guide.</p>}
          {revs.map((rev) => {
            const d = rev.diff ?? {};
            const evs = events.filter((e) => e.revision_id === rev.revision_id);
            const allowed = rev.has_child ? [] : Object.entries(TRANSITIONS[rev.status] ?? {}).filter(([, need]) => need === role).map(([to]) => to);
            const canPublish = role === "publisher" && rev.status === "approved" && !rev.published_edition_id;
            return (
              <section key={rev.revision_id} aria-labelledby={`h-${rev.revision_id}`} className="card min-w-0 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id={`h-${rev.revision_id}`} className="font-serif text-xl">{rev.revision_id}</h2>
                    <p className="text-sm muted">
                      Target edition {rev.target_edition} · uploaded {rev.created_at} by {rev.created_by} · {rev.source_format.toUpperCase()} source
                      {rev.parent_revision_id ? ` · follows ${rev.parent_revision_id}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-ivory-200 dark:bg-navy-700 px-3 py-1 text-sm font-medium" data-status={rev.status}>
                    {rev.published_edition_id ? "Published" : LABEL[rev.status]}
                  </span>
                </div>
                {rev.has_child && !rev.published_edition_id && (
                  <p className="mt-3 text-sm muted">A newer upload replaced this draft, so its review gate is closed. It is kept for the record.</p>
                )}
                <p className="mt-3 break-all font-mono text-xs muted">ODT SHA-256 {rev.odt_sha}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <a className="btn-secondary" href={`/api/artifacts/${rev.source_artifact_id}`}>Uploaded {rev.source_format.toUpperCase()}</a>
                  {rev.source_format === "docx" && <a className="btn-secondary" href={`/api/artifacts/${rev.canonical_odt_artifact_id}`}>Converted ODT</a>}
                  <a className="btn-secondary" href={`/api/artifacts/${rev.pdf_artifact_id}?inline=1`}>Draft PDF</a>
                  {rev.published_edition_id && <Link className="btn-secondary" href={`/guides/SGM-${rev.published_edition_id}`}>Open published edition</Link>}
                </div>

                <h3 className="mt-5 font-semibold">Conversion review</h3>
                {(rev.conversion_report.items ?? []).length === 0 ? (
                  <p className="text-sm muted">No conversion losses detected. Every fact provision matched its template.</p>
                ) : (
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {rev.conversion_report.items!.map((i, k) => <li key={k}><strong>{i.severity === "blocker" ? "Blocker" : "Review"}:</strong> {i.issue}</li>)}
                  </ul>
                )}

                <h3 className="mt-5 font-semibold">Semantic changes vs. {rev.parent_revision_id ? "previous draft" : "current edition"}</h3>
                {d.formatting_only ? (
                  <p className="text-sm">Formatting only: no wording, values, tables, or footnotes changed.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="muted"><tr><th className="py-1 font-medium">Term</th><th className="py-1 font-medium">Before</th><th className="py-1 font-medium">After</th></tr></thead>
                      <tbody>
                        {(d.term_changes ?? []).map((c) => (
                          <tr key={c.fact_id} className="border-t"><td className="py-1.5">{c.topic}</td><td className="py-1.5">{c.before ?? "—"}</td><td className="py-1.5 font-semibold">{c.after ?? "Removed"}</td></tr>
                        ))}
                        {(d.table_cell_changes ?? []).map((c, k) => (
                          <tr key={`t${k}`} className="border-t"><td className="py-1.5">Table {c.table}, row {c.row}, column {c.col + 1}</td><td className="py-1.5">{c.before}</td><td className="py-1.5 font-semibold">{c.after}</td></tr>
                        ))}
                        {(d.footnote_changes ?? []).map((c, k) => (
                          <tr key={`f${k}`} className="border-t"><td className="py-1.5">Footnote</td><td className="py-1.5">{c.before ?? "—"}</td><td className="py-1.5 font-semibold">{c.after ?? "Removed"}</td></tr>
                        ))}
                        {(d.sections_inserted ?? []).map((s) => <tr key={`si${s}`} className="border-t"><td className="py-1.5">Section inserted</td><td>—</td><td className="py-1.5 font-semibold">{s}</td></tr>)}
                        {(d.sections_deleted ?? []).map((s) => <tr key={`sd${s}`} className="border-t"><td className="py-1.5">Section deleted</td><td className="py-1.5">{s}</td><td>—</td></tr>)}
                      </tbody>
                    </table>
                    {!(d.term_changes?.length || d.table_cell_changes?.length || d.footnote_changes?.length || d.sections_inserted?.length || d.sections_deleted?.length) && (
                      <p className="text-sm muted">Wording changed but no tracked term, table, or footnote value changed.</p>
                    )}
                    {(d.unresolved ?? []).map((u, k) => <p key={k} className="mt-2 text-sm"><strong>Needs review:</strong> {u.topic}: {u.issue}</p>)}
                  </div>
                )}

                <h3 className="mt-5 font-semibold">Visual diff vs. current published PDF</h3>
                {d.visual?.changed_pages?.length ? (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {d.visual.pages.filter((p) => p.image).slice(0, 6).map((p) => (
                      <a key={p.page} href={`/api/revisions/${rev.revision_id}/visual/${p.page}`} className="block w-28 text-center text-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/revisions/${rev.revision_id}/visual/${p.page}`} alt={`Page ${p.page} with changed areas highlighted`} className="border" />
                        Page {p.page}
                      </a>
                    ))}
                    {d.visual.pages.filter((p) => !p.image && p.ratio === 1).map((p) => <span key={p.page} className="text-xs">Page {p.page}: added, removed, or resized</span>)}
                  </div>
                ) : (
                  <p className="text-sm muted">No visual differences.</p>
                )}

                <h3 className="mt-5 font-semibold">History</h3>
                <ol className="mt-1 space-y-1 text-sm">
                  {evs.map((e, k) => (
                    <li key={k}>
                      <strong>{LABEL[e.stage] ?? e.stage}</strong> · {e.timestamp} · {e.actor}
                      {e.simulated_receipt_id && <> · receipt <span className="font-mono">{e.simulated_receipt_id}</span></>}
                      <span className="font-mono text-xs muted"> · sha {e.artifact_sha256.slice(0, 12)}</span>
                      {e.notes && <span className="muted"> · {e.notes}</span>}
                    </li>
                  ))}
                </ol>
                {(allowed.length > 0 || canPublish) && <TransitionButtons revisionId={rev.revision_id} targets={allowed} canPublish={canPublish} />}
              </section>
            );
          })}
        </div>
        <aside className="card h-fit min-w-0 space-y-5 p-4">
          <div>
            <h2 className="font-semibold">Acting as</h2>
            <p className="text-sm muted">{actor}</p>
            <RoleSwitcher role={role} />
          </div>
          <div>
            <h2 className="font-semibold">New draft revision</h2>
            {current?.odt_id ? (
              <p className="mt-1 text-sm">
                Start from the <a className="link" href={`/api/artifacts/${current.odt_id}`}>current edition {current.edition_number} ODT</a>, edit it in
                LibreOffice or Word, then upload it here.
              </p>
            ) : (
              <p className="mt-1 text-sm muted">The current edition has no editable source. Upload a reconstructed ODT or DOCX.</p>
            )}
            {role === "editor" ? <UploadForm lineageId={lineage_id} /> : <p className="mt-2 text-sm muted">Switch to the editor role to upload.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
