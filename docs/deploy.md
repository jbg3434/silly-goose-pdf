# Deploying to Render (free tier)

Synthetic demo content — not an insurance contract or coverage advice.

## One-time setup (~5 minutes)

1. Push this repo, then in [Render](https://render.com) choose **New → Blueprint**
   and point it at this repo — `render.yaml` defines everything.
2. Render creates:
   - a **free web service** built from the repo's `Dockerfile`,
   - a **free Postgres 16** database (pgvector included),
   - a **1 GB persistent disk** mounted at `/app/storage` for the corpus.
3. On first boot, `scripts/render-init.sh` applies migrations and seeds,
   generates the 1,000-guide corpus, loads it, and starts indexing in the
   background. The site is usable within ~5 minutes; search coverage fills in
   as indexing proceeds (check `/search/status`; full index takes ~30–60 min
   on the free tier).
4. Optional — cited answers: in the web service's **Environment** tab add
   `OPENCODE_API_KEY` (and optionally `SGM_LLM_MODEL`). Without it, the
   "Get a cited answer" button reports unavailable and everything else works.

## Caveats

- The free web service **sleeps after ~15 min idle**; the next request takes
  ~30 s to wake. Free Postgres also expires after 90 days (recreate it to
  refresh).
- Deploys wipe the ephemeral layer but `storage/` persists on the disk, so
  corpus generation only runs once.
