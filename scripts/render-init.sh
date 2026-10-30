#!/usr/bin/env bash
# First-boot init for Render: restore the pre-indexed dump, then serve.
# Synthetic demo content — not an insurance contract or coverage advice.
set -uo pipefail
cd "$(dirname "$0")/.."

# Render's DATABASE_URL may be postgres:// or postgresql://; pg_restore takes either.
echo "waiting for database…"
for i in $(seq 1 40); do
  pg_isready -d "$DATABASE_URL" -t 3 && break
  sleep 5
done

EMPTY=$(psql "$DATABASE_URL" -Atc "SELECT NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='chunks')" 2>/dev/null || echo t)
if [ "$EMPTY" = "t" ] || ! psql "$DATABASE_URL" -Atc "SELECT 1 FROM chunks LIMIT 1" >/dev/null 2>&1; then
  echo "restoring pre-indexed corpus (~1-3 min)…"
  pg_restore --no-owner --no-privileges -d "$DATABASE_URL" /app/prebuilt.dump \
    || echo "restore reported errors (often harmless extension/schema notices)"
else
  echo "corpus already loaded"
fi

echo "applying any newer migrations…"
pnpm db:migrate
pnpm db:seed

exec pnpm --filter web start
