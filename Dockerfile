# ── Frontend (Vite → /app/public in final image) ─────────────────────────────
FROM node:20-bookworm-slim AS web-builder
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
# --ignore-scripts avoids esbuild postinstall race (ETXTBSY) on Docker overlayfs;
# then install the platform binary once in a separate step.
RUN npm ci --ignore-scripts \
  && node node_modules/esbuild/install.js
COPY web/ ./
# Same origin as API in the container (port 3000). Media CDN comes from gitignored `.env`.
ARG VITE_PAD_CDN_ORIGIN=
ENV VITE_API_BASE=
ENV VITE_PAD_CDN_ORIGIN=$VITE_PAD_CDN_ORIGIN
RUN npm run build

# ── Backend ─────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates wget curl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=web-builder /app/web/dist ./public
COPY docs ./docs
COPY exports/patterns ./exports/patterns
COPY seed/gamewith-vanish.sqlite /seed/gamewith-vanish.sqlite
COPY seed/void-super-gravity.sqlite /seed/void-super-gravity.sqlite
COPY dungeon-details/seed ./dungeon-details/seed
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV SQLITE_PATH=/data/pad.db
ENV WEB_STATIC_PATH=/app/public
ENV CATEGORY_JSON_EXPORT_DIR=exports/category-bundles
ENV FILTER_TYPE_CATEGORIES_PATH=docs/filter-type-categories.json
ENV PATTERNS_GROUP_PATH=exports/patterns/patterns_group.json
ENV PATTERNS_CATALOG_PATH=exports/patterns/pad_generated_patterns.json
ENV TYPEORM_SYNC=true
ENV RUN_TRANSFORM=true
ENV START_HTTP=true
ENV HTTP_PORT=3000
ENV VANISH_AWOKEN_SQLITE_PATH=/seed/gamewith-vanish.sqlite
ENV VOID_SUPER_GRAVITY_SQLITE_PATH=/seed/void-super-gravity.sqlite
ENV DUNGEON_DETAILS_SEED_DIR=/app/dungeon-details/seed/dungeons

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "/docker-entrypoint.sh"]
