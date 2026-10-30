# Silly Goose Mutual — all-in-one demo image (app + corpus toolchain).
# Synthetic demo content — not an insurance contract or coverage advice.
FROM node:20-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip libreoffice tesseract-ocr fonts-dejavu curl ca-certificates gnupg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pip3 install --break-system-packages -r generator/requirements.txt \
    && pnpm corpus:build \
    && pnpm --filter web build \
    && pnpm --filter web exec tsx scripts/warmup-embed.ts

ENV NODE_ENV=production SGM_PYTHON=/usr/bin/python3 TRANSFORMERS_CACHE=/app/.hf-cache PORT=3000
EXPOSE 3000
CMD ["bash", "scripts/render-init.sh"]
