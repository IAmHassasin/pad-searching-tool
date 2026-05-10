# Build tools required for better-sqlite3 (native addon).
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

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates wget curl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh /docker-entrypoint.sh
# Windows CRLF → Linux "exec /docker-entrypoint.sh: no such file or directory"
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV SQLITE_PATH=/data/pad.db
# Create pad_categorized via TypeORM synchronize unless you set TYPEORM_SYNC=false
ENV TYPEORM_SYNC=true
# One container: seed copy → transform → HTTP (override for job-only)
ENV RUN_TRANSFORM=true
ENV START_HTTP=true
ENV HTTP_PORT=3000

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "/docker-entrypoint.sh"]
