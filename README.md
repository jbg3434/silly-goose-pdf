# Silly Goose Mutual — synthetic product guide library

A document-intelligence demo over a library of wholly synthetic insurance product guides for a fictional insurer,
**Silly Goose Mutual**. 10 product families × 50 states × 2 editions (a legacy PDF and an editable ODT successor).

> **Synthetic demo content — not an insurance contract or coverage advice.** Every company, form, rule, rate, limit,
> and address is invented. Filing and approval records are a simulated DOI workflow.

## Status

| Stage | Scope | State |
| --- | --- | --- |
| 1 | Foundation and brand: app, design system, Gus, schema, local services, home/catalog/library | Done |
| 2 | Corpus generator: facts, overrides, 1,000 PDFs, 500 ODT/DOCX, manifest, challenge set | Not started |
| 3 | Version workflow: uploads, diffs, simulated approvals, publication | Not started |
| 4 | Ingestion and retrieval: extraction/OCR, chunking, lexical + vector index | Not started |
| 5 | Guide workspace: web reader, PDF viewer, find, cited answers | Not started |
| 6 | Portfolio research: cross-library search, comparison matrix | Not started |
| 7 | Hardening: eval suite, accessibility, performance, handoff | Not started |

Until stage 2 lands, the library lists the 1,000 catalog records with their edition lineage, and each guide page says
plainly that it has not been generated yet.

## Requirements

- Node 20 and pnpm 9 (`corepack enable` or `npm i -g pnpm@9`)
- Docker (for PostgreSQL 16 + pgvector)
- Python 3.10+ (brand sound synthesis now; corpus generator in stage 2)

## Run locally

```bash
cp .env.example apps/web/.env.local   # optional; defaults match docker compose
pnpm install                          # 1. dependencies
pnpm services:up                      # 2. local services (Postgres + pgvector on :5433)
pnpm db:migrate && pnpm db:seed       # 3. schema + catalog/lineage seed (corpus build joins this in stage 2)
pnpm dev                              # 4. app on http://localhost:3000
```

Other commands: `pnpm lint`, `pnpm typecheck`, `pnpm --filter web brand:build` (regenerate Gus SVG exports),
`python3 scripts/brand/make_sounds.py apps/web/public/sounds` (regenerate Gus sounds).

## Layout

```text
apps/web/            Next.js 14 app (App Router, TypeScript, Tailwind)
  src/brand/gus.ts   Gus master artwork (parametric SVG) — source for all poses, icon, light/dark exports
  src/components/gus Mascot component, sound/motion/hide preferences, captions
  src/lib/           Postgres access and typed queries
  scripts/           migrate, seed, brand export
data/                Canonical catalog source: products, states, editions
db/migrations/       SQL schema (facts, overrides, editions, artifacts, approvals, chunks, index status)
docs/                Architecture note
scripts/brand/       Sound synthesis
storage/             Local stand-in for object storage (git-ignored)
```

See [docs/architecture.md](docs/architecture.md) for design decisions.
