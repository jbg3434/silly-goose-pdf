# Deploying to Render (free tier)

Synthetic demo content — not an insurance contract or coverage advice.

## One-time setup (~5 minutes)

1. Push this repo, then in [Render](https://render.com) choose **New → Blueprint**
   and point it at this repo — `render.yaml` defines everything.
2. Render creates:
   - a **free web service** built from the repo's `Dockerfile`,
   - a **free Postgres 16** database (pgvector included).
   Free-tier services can't mount disks and the free 512 MB RAM is too small
   to index at boot, so the corpus is generated AND fully indexed during the
   Docker build (which has plenty of RAM) and shipped inside the image as a
   compressed Postgres dump (~15 min build).
3. On first boot, `scripts/render-init.sh` restores the pre-indexed dump
   (~1–3 min), applies any newer migrations, seeds, and starts the app.
   Everything — including full-text and vector search — works immediately.
4. Optional — cited answers: in the web service's **Environment** tab add
   `OPENCODE_API_KEY` (and optionally `SGM_LLM_MODEL`). Without it, the
   "Get a cited answer" button reports unavailable and everything else works.

## Caveats

- The free web service **sleeps after ~15 min idle**; the next request takes
  ~30 s to wake. Free Postgres also expires after 90 days (recreate it to
  refresh).
- Redeploys rebuild the image and re-restore the dump only when the chunks
  table is empty; an existing populated database is left alone.
