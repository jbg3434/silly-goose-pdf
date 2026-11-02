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
| 3 | Version workflow: uploads, diffs, simulated approvals, publication ([docs/workflow.md](docs/workflow.md)) | Done |
| 4 | Ingestion and retrieval: extraction/OCR, chunking, lexical + vector + hybrid search, eval harness ([docs/retrieval.md](docs/retrieval.md)) | Done |
| 5 | Guide workspace: text reader, find-in-guide, cited answers via OpenCode ([docs/workspace.md](docs/workspace.md)) | Done |
| 6 | Portfolio research: /compare state matrix (facts × 50 states, overrides highlighted) | Done |
| 7 | Hardening + free Render deploy (Dockerfile, render.yaml, Postgres+pgvector, storage disk) | Done |

The corpus build generates every guide from canonical facts and state/edition overrides. Each guide page shows the
published PDF, its source files with SHA-256 hashes, state differences, edition changes, and a simulated approval trail.
See [docs/corpus.md](docs/corpus.md) for the generation contract, challenge set, and reproducibility notes.

## Accuracy

Two benchmarks, both run against the full 1,002-guide index. The guides are synthetic, so these results are accuracy against
known answers, not proof of accuracy on real guides or real user traffic.

**Realistic hard questions** (`data/ground-truth/realistic-hard.jsonl`, 43 hand-labelled questions written the way agents
and underwriters ask: unscoped, shorthand, scenarios, jargon, false premises, math, edition changes, typos, prompt
injection, and questions no guide answers). A pass needs the right value in the cited answer **and** a citation to a page
that states it. Grading uses only document ID + page, not generator fact tags, so the same file format works for real guides.

| Run | Passed | Wrong answers | Unanswerable declined |
| --- | --- | --- | --- |
| Full corpus | 41 / 43 | 0 | 6 / 6 |
| Synthetic Q&A (`faq`) blocks removed, about 21% of passages, closer to real guides | 39 / 43 | 0 | 6 / 6 |

Every miss was a decline caused by insurance vocabulary the search doesn't map yet: "uber" vs. rideshare, "GVWR", and
without the Q&A blocks also "AOP ded on an HO" and "1000 watt e-bike". 8 questions list a second gold page (a summary
table, referral table or state appendix) that was confirmed by hand to state the same value.

**Generator benchmark** (`data/ground-truth/eval-queries.json`, 117 templated questions, 12 with no answer):

| Search mode | Recall@10 | MRR | Scope violations | p50 / p95 |
| --- | --- | --- | --- | --- |
| Hybrid (default) | 99% (104/105) | 0.717 | 0 | 17 / 62 ms |
| Vector only | 97.1% | 0.542 | 0 | 12 / 22 ms |
| Keyword only | 95.2% | 0.628 | 0 | 9 / 34 ms |

All 12 unanswerable questions were declined, and every result cited a valid PDF page range.

Run them yourself:

```bash
pnpm eval:retrieval                                              # search-level benchmark (overwrites reports/eval/*.json)
python3 scripts/eval_answers.py --base-url http://localhost:3100 # answer-level hard set; needs the app running + OPENCODE_API_KEY
# against a password-gated deployment: SGM_COOKIE="sgm_auth=<session cookie>" python3 scripts/eval_answers.py --base-url https://...
```

## Requirements

- Node 20 and pnpm 9 (`corepack enable` or `npm i -g pnpm@9`)
- Docker (for PostgreSQL 16 + pgvector)
- Python 3.10+ with `pip install -r generator/requirements.txt`
- LibreOffice 7.3+ (`soffice` on PATH) for ODT → PDF/DOCX export
- ffmpeg and Chrome/Chromium (only to regenerate the Gus community videos; set `CHROME` if it is not on PATH)

## Run locally

```bash
cp .env.example apps/web/.env.local   # optional; defaults match docker compose
pnpm install                          # 1. dependencies
pnpm services:up                      # 2. local services (Postgres + pgvector on :5433)
pnpm db:migrate && pnpm db:seed       # 3. schema + catalog/lineage seed
pnpm corpus:build && pnpm corpus:load # 4. 1,000 PDFs + 500 ODT/DOCX (about 3 minutes on 8 cores), then load into Postgres
pnpm index:build                      # 5. extract/OCR/chunk/embed every published PDF (about 35 minutes on 8 cores; idempotent)
pnpm dev                              # 6. app on http://localhost:3000 (search at /search, index status at /search/status)
```

## Run with Docker Compose (no local toolchain)

```bash
docker compose up --build       # Postgres + app; ~20 min first build, then ~2 min corpus restore
```

App on http://localhost:3100. The image builds the corpus artifacts during `docker build` and the boot
script downloads the pre-indexed database dump (`SGM_DUMP_URL`), so no indexing runs locally. Optional env
on the `web` service: `GUS_DEMO_PASSWORD_HASH` (demo gate), `OPENCODE_API_KEY` (cited answers),
`SGM_DUMP_URL` (dump source override).

## Project site (GitHub Pages)

`site/` is a static landing page that introduces Gus and the project. `pnpm site:build` assembles it into `_site/` with the
Gus art and sounds from `apps/web/public`; `.github/workflows/pages.yml` deploys it on pushes to `main`. One-time setup:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

Other commands: `pnpm eval:retrieval` (score lexical/vector/hybrid search against `data/ground-truth/eval-queries.json`), `pnpm lint`, `pnpm typecheck`, `pnpm --filter web brand:build` (regenerate Gus SVG exports),
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
