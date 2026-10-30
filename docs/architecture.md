# Architecture note

## Choices so far

| Concern | Choice | Why |
| --- | --- | --- |
| Web app | Next.js 14 App Router, TypeScript, Tailwind | Server components query Postgres directly; one deployable unit |
| Database | PostgreSQL 16 + `pgvector` (`pgvector/pgvector:pg16` image) | Metadata, full-text search (`tsvector`), and vectors in one store |
| Artifact storage | Local `storage/` directory, addressed by SHA-256 | Local stand-in for object storage; swap behind an adapter later |
| Fonts | Source Serif 4 (display), Inter (UI/body) via `next/font` | Editorial serif + neutral sans, self-hosted at build |
| Mascot art | Parametric SVG in `src/brand/gus.ts` | One editable master renders every pose, theme, and the icon |
| Mascot audio | Synthesized WAVs from `scripts/brand/make_sounds.py` | Original, deterministic, no licensing questions |

## Data model

`db/migrations/001_init.sql` implements the spec's schema:

- **Source of truth:** `products`, `sections`, `facts`, `overrides` (structured facts; never only in vectors).
- **Lineage:** `lineages` (one product/state guide) → `editions` (ordered by `edition_number`, `parent_edition_id`) →
  `artifacts` (immutable, SHA-256, `parent_artifact_id` for draft revisions) and `documents` (one per edition).
- **Current-edition rule:** a partial unique index allows at most one `published` edition with `current_to IS NULL` per lineage,
  so an old guide cannot be labeled current alongside the new one.
- **Workflow:** `approval_events` bind every stage change to an exact `artifact_sha256`; receipts are simulated.
- **Derived, rebuildable:** `evidence_spans`, `chunks` (generated `tsvector` + `vector(384)`), `index_status`, `search_runs`.

IDs: lineage `HO-NY`, edition `HO-NY-E2`, document `SGM-HO-NY-E2`.

## Mascot controls

`GusProvider` stores preferences in `localStorage` (`sgm.gus.prefs.v1`): sound (muted by default), hide Gus, motion
(system / reduced / full), and dark mode. Every cue sets a caption shown on screen and announced through a polite live region.
Reduced motion disables all animation through a root class; "system" follows `prefers-reduced-motion`.

## Corpus generator (stage 2)

- **Python generator** in `generator/sgm`. ReportLab renders the legacy edition-1 PDFs, and odfpy writes the edition-2 ODT
  sources. LibreOffice exports DOCX and PDF from the ODT, so the editable source and the published PDF come from the same
  authoring file.
- **Determinism over convenience:** RNGs are keyed on the committed seed and document identity, and all output metadata is
  normalized (see `docs/corpus.md`).
- **Evidence is located, not assumed:** fact pages for edition 2 come from text extraction of the rendered PDF. Edition-1 pages
  come from ReportLab layout callbacks and are cross-checked against extraction where a text layer exists.
- **Artifacts are served by checksum:** `/api/artifacts/:id` refuses to serve bytes whose SHA-256 differs from the recorded value.
- **Mascot videos:** the "Gus in the Community" clips are rendered procedurally (`scripts/brand/make_videos.py`). They are
  silent, have WebVTT captions, never autoplay, and are labeled as staged fiction.
