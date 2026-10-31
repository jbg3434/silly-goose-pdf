#!/usr/bin/env bash
# First-boot init for Render: fetch the pre-indexed DB dump, restore, serve.
# Synthetic demo content — not an insurance contract or coverage advice.
set -uo pipefail
cd "$(dirname "$0")/.."

# Pre-indexed corpus dump (built once, published as a GitHub Release asset so
# deploys never have to re-index inside the image).
DUMP_URL="${SGM_DUMP_URL:-https://github.com/jbg3434/silly-goose-pdf/releases/download/prebuilt-db-v2/prebuilt-v2.dump}"

# Bind $PORT immediately with a minimal listener so Render's port scan
# succeeds while the (multi-minute) dump restore runs; the real app takes
# the port over at the end of this script.
PORT="${PORT:-3000}"
python3 -m http.server "$PORT" --bind 0.0.0.0 >/dev/null 2>&1 &
STUB_PID=$!

echo "waiting for database…"
for i in $(seq 1 40); do
  pg_isready -d "$DATABASE_URL" -t 3 && break
  sleep 5
done

if [ "$(psql "$DATABASE_URL" -Atc "SELECT count(*) FROM index_status WHERE state='indexed'" 2>/dev/null || echo 0)" = "0" ]; then
  echo "downloading pre-indexed dump…"
  curl -fSL --retry 3 -o /tmp/prebuilt.dump "$DUMP_URL"
  echo "restoring corpus (~1-3 min)…"
  # --clean drops stale objects first: the free Postgres persists across
  # deploys and may still hold rows from an aborted earlier indexing run.
  pg_restore --clean --if-exists --no-owner --no-privileges --jobs=4 -d "$DATABASE_URL" /tmp/prebuilt.dump \
    || echo "restore reported errors (often harmless extension/schema notices)"
  rm -f /tmp/prebuilt.dump
else
  echo "corpus already loaded"
fi

echo "applying any newer migrations…"
pnpm db:migrate
pnpm db:seed

# Structured guide view: build GuideBlocks if the dump predates them.
if [ "$(psql "$DATABASE_URL" -Atc "SELECT count(*) FROM guide_blocks" 2>/dev/null || echo 0)" = "0" ]; then
  echo "building guide blocks (~2 min, no embeddings needed)…"
  pnpm --filter web blocks:build || echo "guide-block build failed (guide view will be unavailable)"
fi

kill "$STUB_PID" 2>/dev/null
sleep 1
exec pnpm --filter web start
