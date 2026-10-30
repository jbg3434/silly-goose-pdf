# Silly Goose Mutual — all-in-one demo image (app + corpus toolchain).
# Synthetic demo content — not an insurance contract or coverage advice.
FROM node:20-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip libreoffice tesseract-ocr fonts-dejavu curl ca-certificates gnupg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends \
       postgresql-16 postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pip3 install --break-system-packages -r generator/requirements.txt \
    && pnpm corpus:build \
    && pnpm --filter web build

# Pre-index at build time: plenty of RAM here, unlike a 512 MB free instance.
# Ships as a compressed dump restored at boot by scripts/render-init.sh.
ENV TRANSFORMERS_CACHE=/app/.hf-cache SGM_PYTHON=/usr/bin/python3
RUN su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /tmp/pgdata -E UTF8" \
    && su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -o '-k /tmp -p 5432' -w start" \
    && su postgres -c "createuser -h /tmp -p 5432 -s goose" \
    && su postgres -c "createdb -h /tmp -p 5432 -O goose silly_goose" \
    && su postgres -c "psql -h /tmp -p 5432 -c \"ALTER USER goose PASSWORD 'goose'\"" \
    && DATABASE_URL=postgres://goose:goose@localhost:5432/silly_goose \
       sh -c 'pnpm db:migrate && pnpm db:seed && pnpm corpus:load && pnpm index:build' \
    && su postgres -c "pg_dump -h /tmp -p 5432 -Fc silly_goose" > /app/prebuilt.dump \
    && su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -w stop" \
    && rm -rf /tmp/pgdata

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["bash", "scripts/render-init.sh"]
