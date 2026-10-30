#!/usr/bin/env bash
# First-boot init for Render: fetch the pre-indexed DB dump, restore, serve.
# Synthetic demo content — not an insurance contract or coverage advice.
set -uo pipefail
cd "$(dirname "$0")/.."

# Pre-indexed corpus dump (built once, published as a GitHub Release asset so
# deploys never have to re-index inside the image).
DUMP_URL="${SGM_DUMP_URL:-https://github.com/jbg3434/silly-goose-pdf/releases/download/prebuilt-db-v1/prebuilt.dump}"

echo "waiting for database…"
for i in $(seq 1 40); do
  pg_isready -d "$DATABASE_URL" -t 3 && break
  sleep 5
done

if ! psql "$DATABASE_URL" -Atc "SELECT 1 FROM chunks LIMIT 1" >/dev/null 2>&1; then
  echo "downloading pre-indexed dump…"
  curl -fSL --retry 3 -o /tmp/prebuilt.dump "$DUMP_URL"
  echo "restoring corpus (~1-3 min)…"
  pg_restore --no-owner --no-privileges -d "$DATABASE_URL" /tmp/prebuilt.dump \
    || echo "restore reported errors (often harmless extension/schema notices)"
  rm -f /tmp/prebuilt.dump
else
  echo "corpus already loaded"
fi

echo "applying any newer migrations…"
pnpm db:migrate
pnpm db:seed

exec pnpm --filter web start
