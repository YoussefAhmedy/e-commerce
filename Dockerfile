# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Printique — production image (multi-stage, non-root, ~160MB runtime)
# Build:  docker build -t printique .
# Run:    docker run -p 3000:3000 -v printique-data:/data \
#           -e APP_SECRET="$(openssl rand -hex 32)" printique
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: full dependency tree for building ───────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── Stage 2: build the Next.js app (pages are server-dynamic — nothing about
#    runtime data is baked into the bundle) ────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATA_DIR=/tmp/build-data
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: slim runtime — standalone server, sqlite volume, non-root ───────
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data

# Non-root user owns app + data dir (SQLite DB and uploads live on the volume).
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /data && chown -R app:app /data

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

# Migrations run at boot (instrumentation hook) — the image itself never
# contains a database, secrets, or customer data.
CMD ["node", "server.js"]
