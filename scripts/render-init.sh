#!/usr/bin/env bash
# First-boot init for Render: schema -> corpus -> load -> index, then serve.
# Synthetic demo content — not an insurance contract or coverage advice.
set -uo pipefail
cd "$(dirname "$0")/.."

echo "applying migrations…"
for i in $(seq 1 30); do
  pnpm db:migrate && break
  echo "database not ready, retrying in 5s…"
  sleep 5
done
pnpm db:seed

pnpm corpus:load

echo "indexing corpus in the background…"
(pnpm index:build > /tmp/index.log 2>&1 &)

exec pnpm --filter web start
