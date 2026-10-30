# Revisions, diffs, and the simulated approval workflow

Everything here is synthetic. "Filing", "approval", and receipt IDs are simulated; no regulator is contacted.

## Flow

1. **Upload.** An editor uploads an edited ODT or DOCX on `/guides/<id>/revisions`
   (`POST /api/lineages/<lineage>/revisions`). The bytes are stored once under `storage/uploads/<sha256>.<ext>` and never
   rewritten. Every upload creates a new revision; the newest earlier revision becomes its parent.
2. **Conversion review.** `generator/sgm/revision.py ingest` converts DOCX to ODT with LibreOffice, then flags tracked
   changes, comments, lost tables or footnotes, and provisions whose wording no longer matches the fact template.
3. **Semantic diff.** Facts are extracted from the provisions (`N.N Topic. statement`) and compared by fact ID with the
   parent revision, or with the current edition for the first draft. The diff lists term-value changes, inserted or deleted
   sections, table-cell changes, and footnote changes. Edits that leave all text unchanged are reported as formatting-only.
4. **Visual diff.** The draft PDF is compared page by page with the current published PDF; changed pixels are highlighted.
5. **Review gates.** The state machine (enforced in `apps/web/src/lib/revisions.ts`) moves a revision through
   `draft → internal_review → ready_for_filing → submitted → approved`, with `rejected` and `withdrawn` exits.
   Each step needs a specific demo role (editor, reviewer, compliance) and records the actor, role, timestamp, notes,
   and the ODT SHA-256. A newer upload closes the gate on its parent, so edits after review restart review.
6. **Publish.** Only a publisher can publish, only an `approved` revision, and only if the stored ODT still hashes to
   `approved_sha256`. Publishing creates the next edition (3, 4, …), supersedes the previous one, exports DOCX from the
   approved ODT, and binds ODT, DOCX, and PDF to that edition. It also queues index work for the new PDF.
   Rejected and withdrawn drafts stay visible in the history.

Roles are a demo cookie (`sgm.role`) switched on the revisions page, not authentication.

## Commands

```bash
pnpm db:migrate                                    # adds revisions, audit_events (003_revisions.sql)
cd generator && python3 -m unittest discover -s tests
python3 scripts/workflow/seed_revisions.py         # sample rejected, revised, and DOCX drafts (app must be running)
```

The web app runs the Python worker with `SGM_PYTHON` (default `python3`). That interpreter needs
`generator/requirements.txt` and LibreOffice on `PATH`.
