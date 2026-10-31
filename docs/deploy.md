# Deploying to Render (free tier)

Synthetic demo content — not an insurance contract or coverage advice.

## One-time setup (~5 minutes)

1. Push this repo, then in [Render](https://render.com) choose **New → Blueprint**
   and point it at this repo — `render.yaml` defines everything.
2. Render creates:
   - a **free web service** built from the repo's `Dockerfile`,
   - a **free Postgres 16** database (pgvector included).
   Free-tier services can't mount disks and the free 512 MB RAM is too small
   to index at boot, so the corpus is generated during the Docker build and
   the fully indexed database ships as a GitHub Release asset
   (`prebuilt-db-v1`, ~156 MB pg_dump). Build time stays ~7 min — no indexing
   inside the image and no re-indexing on redeploy.
3. On first boot, `scripts/render-init.sh` downloads and restores the dump
   (~2–4 min), applies any newer migrations, seeds, and starts the app.
   Everything — including full-text and vector search — works immediately.
   If the corpus or index pipeline versions ever change, rebuild the dump
   locally (`pg_dump -Fc`) and publish a new release, then point the service's
   `SGM_DUMP_URL` env var at it.
4. Optional — cited answers: in the web service's **Environment** tab add
   `OPENCODE_API_KEY` (and optionally `SGM_LLM_MODEL`). Without it, the
   "Get a cited answer" button reports unavailable and everything else works.

## Caveats

- The free web service **sleeps after ~15 min idle**; the next request takes
  ~30 s to wake. Free Postgres also expires after 90 days (recreate it to
  refresh).
- Redeploys rebuild the image and re-restore the dump only when the chunks
  table is empty; an existing populated database is left alone.

## Demo access gate

Set `GUS_DEMO_PASSWORD_HASH` in the web service's Environment tab to arm the
site-wide gate. Generate the value locally and never commit it:

```bash
python3 -c 'import hashlib,secrets;s=secrets.token_hex(8);print("sha256$%s$%s"%(s,hashlib.sha256((s+input("password: ")).encode()).hexdigest()))'
```

The gate issues an 8-hour HMAC-signed session cookie (the password never
reaches the client), rate-limits login attempts (10/15 min per IP), covers
every page and API/artifact route (APIs return 401 JSON), and supports sign
out via `GET /api/pw?logout=1` or `DELETE /api/pw`. `SITE_PASSWORD` remains
as a deprecated plaintext fallback for compatibility with earlier deploys;
prefer the hash.

**The gate fails closed in production.** With `NODE_ENV=production` (every
deployed build), a missing secret locks the whole site to the unlock page and
401s every API instead of opening it — an unset env can never expose the demo.
Local dev stays open by default; set `SGM_REQUIRE_GATE=1` to force the gate in
dev, or `SGM_REQUIRE_GATE=0` to force it open in production.
Editor/reviewer workflow actions additionally require an authorized role.
