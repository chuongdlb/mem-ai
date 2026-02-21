FROM node:22-slim AS builder

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json ./
COPY packages/dashboard/package.json packages/dashboard/

RUN pnpm install --frozen-lockfile || pnpm install

COPY packages/dashboard/ packages/dashboard/

RUN pnpm --filter @memai/dashboard build

# ── Serve with nginx ────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html

# SPA fallback
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
