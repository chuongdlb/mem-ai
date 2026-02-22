FROM node:22-slim AS builder

RUN corepack enable
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/

RUN pnpm --filter @memai/shared build
RUN pnpm --filter @memai/api build

# ── Production ──────────────────────────────────────────────────
FROM node:22-slim

RUN corepack enable
WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY --from=builder /app/packages/api/package.json packages/api/
COPY --from=builder /app/packages/api/dist packages/api/dist/
COPY --from=builder /app/packages/api/src/db/migrations packages/api/src/db/migrations/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/packages/api/node_modules packages/api/node_modules/
COPY --from=builder /app/packages/shared/node_modules packages/shared/node_modules/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "packages/api/dist/index.js"]
