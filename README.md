# Silly Goose Mutual — synthetic product guide library

A document-intelligence demo over a library of wholly synthetic insurance product guides for a fictional insurer,
**Silly Goose Mutual**. 10 product families × 50 states × 2 editions (a legacy PDF and an editable ODT successor).

> **Synthetic demo content — not an insurance contract or coverage advice.** Every company, form, rule, rate, limit,
> and address is invented. Filing and approval records are a simulated DOI workflow.

## Status

| Stage | Scope | State |
| --- | --- | --- |
| 1 | Foundation and brand: app, design system, Gus, schema, local services, home/catalog/library | Done |
| 2 | Corpus generator: facts, overrides, 1,000 PDFs, 500 ODT/DOCX, manifest, challenge set | Done |
| 3 | Version workflow: uploads, diffs, simulated approvals, publication | Not started |
| 4 | Ingestion and retrieval: extraction/OCR, chunking, lexical + vector index | Not started |
| 5 | Guide workspace: web reader, PDF viewer, find, cited answers | Not started |
| 6 | Portfolio research: cross-library search, comparison matrix | Not started |
| 7 | Hardening: eval suite, accessibility, performance, handoff | Not started |

The corpus build generates every guide from canonical facts and state/edition overrides. Each guide page shows the
published PDF, its source files with SHA-256 hashes, state differences, edition changes, and a simulated approval trail.
See [docs/corpus.md](docs/corpus.md) for the generation contract, challenge set, and reproducibility notes.

## Requirements

- Node 20 and pnpm 9 (`corepack enable` or `npm i -g pnpm@9`)
- Docker (for PostgreSQL 16 + pgvector)
- Python 3.10+ with `pip install -r generator/requirements.txt`
- LibreOffice 7.3+ (`soffice` on PATH) for ODT → PDF/DOCX export
- ffmpeg (only to regenerate the Gus community videos)

## Run locally

```bash
cp .env.example apps/web/.env.local   # optional; defaults match docker compose
pnpm install                          # 1. dependencies
pnpm services:up                      # 2. local services (Postgres + pgvector on :5433)
pnpm db:migrate && pnpm db:seed       # 3. schema + catalog/lineage seed
pnpm corpus:build && pnpm corpus:load # 4. 1,000 PDFs + 500 ODT/DOCX (about 3 minutes on 8 cores), then load into Postgres
pnpm dev                              # 5. app on http://localhost:3000
```

## Project site (GitHub Pages)

`site/` is a static landing page that introduces Gus and the project. `pnpm site:build` assembles it into `_site/` with the
Gus art and sounds from `apps/web/public`; `.github/workflows/pages.yml` deploys it on pushes to `main`. One-time setup:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

Other commands: `pnpm lint`, `pnpm typecheck`, `pnpm --filter web brand:build` (regenerate Gus SVG exports),
`python3 scripts/brand/make_sounds.py apps/web/public/sounds` (regenerate Gus sounds),
`python3 scripts/brand/make_videos.py apps/web/public/videos` (regenerate the fictional "Gus in the Community" clips).
For a quick partial build: `cd generator && python3 -m sgm.build --only CY,PU --states NY,NJ,PA --out /tmp/sgm`.

## Layout

```text
apps/web/            Next.js 14 app (App Router, TypeScript, Tailwind)
  src/brand/gus.ts   Gus master artwork (parametric SVG) — source for all poses, icon, light/dark exports
  src/components/gus Mascot component, sound/motion/hide preferences, captions
  src/lib/           Postgres access and typed queries
  scripts/           migrate, seed, brand export
data/                Canonical catalog source: products, states, editions, synthetic rule references
data/ground-truth/   Challenge set and eligibility scenarios with expected values and PDF page references
generator/sgm/       Deterministic corpus generator (facts, overrides, legacy PDF, ODT, validation, manifest)
db/migrations/       SQL schema (facts, overrides, editions, artifacts, approvals, chunks, index status)
docs/                Architecture note
scripts/brand/       Sound synthesis
storage/             Local stand-in for object storage (git-ignored); corpus build writes storage/corpus
```

See [docs/architecture.md](docs/architecture.md) for design decisions.
