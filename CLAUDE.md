# MemAI

Centralizes AI agent memories across coding tools. Thesis students use multiple AI CLIs (Claude Code, Gemini CLI, Cursor, Kilo Code, OpenCode) that each maintain isolated context. MemAI unifies this into a shared memory layer with supervisor oversight via a React dashboard.

## Monorepo Structure

| Package | Tech | Description |
|---|---|---|
| `packages/shared` | TypeScript | Shared types, Zod schemas, constants (`@memai/shared`) |
| `packages/api` | Fastify 5 + Drizzle + pgvector | REST API, OAuth, embeddings (`@memai/api`) |
| `packages/mcp-server` | MCP SDK | MCP server for agent CLIs (`memai-mcp`) |
| `packages/dashboard` | React 19 + Vite 6 + Tailwind 4 | Admin dashboard (`@memai/dashboard`) |

All packages use ESM. Managed by pnpm workspaces + Turborepo.

## Commands

```bash
pnpm install                          # Install all deps
pnpm build                            # Build all (turbo)
pnpm dev                              # Dev servers
EMBEDDING_PROVIDER=none pnpm test     # Run 55 tests (avoids Ollama dep)
pnpm db:generate                      # Generate Drizzle migrations
pnpm db:migrate                       # Run migrations
docker compose -f docker-compose.dev.yml up  # Local Postgres + Ollama
```

## Production Deployment

**Live at**: `https://mem-ai.chuongdang.com` (dashboard) / `https://api.mem-ai.chuongdang.com` (API)

### Architecture

```
Internet → Caddy :443 (auto-HTTPS via Let's Encrypt)
  ├─ mem-ai.chuongdang.com      → dashboard :80 (nginx SPA)
  └─ api.mem-ai.chuongdang.com  → api :3000 (Fastify)

DigitalOcean sgp1 (Singapore) — s-1vcpu-2gb ($12/mo)
Docker Compose: caddy, api, dashboard, postgres (pgvector:pg16)
EMBEDDING_PROVIDER=none (2GB RAM, no Ollama)
```

### CI/CD Pipeline

1. **CI** (`.github/workflows/ci.yml`): Push to `main`/`dev` → build + typecheck → test (with pgvector service) → Docker build & push to GHCR (main only)
2. **Deploy** (`.github/workflows/deploy.yml`): Triggered by CI success on `main` → `doctl` provisions droplet/firewall (idempotent) → SCP compose files → SSH deploy → migrations → health check

### GitHub Secrets

| Secret | Purpose |
|---|---|
| `DIGITALOCEAN_ACCESS_TOKEN` | doctl API auth |
| `VPS_SSH_PUBLIC_KEY` / `VPS_SSH_KEY` | SSH keypair for droplet access |
| `DOMAIN` | `mem-ai.chuongdang.com` |
| `DB_PASSWORD` | Postgres password (hex-only, no special chars — breaks URL parsing) |
| `JWT_SECRET` | JWT signing key (64+ chars) |
| `ENCRYPTION_KEY` | AES-256 (64 hex chars) |
| `OAUTH_GITHUB_CLIENT_ID` / `OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth app |
| `OAUTH_GOOGLE_CLIENT_ID` / `OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth app |
| `API_URL` | `https://api.mem-ai.chuongdang.com` |
| `DASHBOARD_URL` | `https://mem-ai.chuongdang.com` |

### Deployment Gotchas (Lessons Learned)

- **DB_PASSWORD must be hex-only** — chars like `/` and `=` break `postgres://` URL parsing and cause API crash loops
- **pgvector extension must be enabled before migrations** — `CREATE EXTENSION IF NOT EXISTS vector;` or migrations fail with `type "vector" does not exist`
- **Migrations need correct working dir** — `docker exec -w /app/packages/api` because migrate script uses relative path `./src/db/migrations`
- **`node:22-slim` has no `curl`** — use `wget -qO-` for health checks inside the API container
- **API Dockerfile needs root `tsconfig.json`** — shared package extends `../../tsconfig.json`
- **GHCR push needs `permissions: packages: write`** in the CI workflow docker job
- **GitHub `/user/emails` API can return error objects** — always guard with `Array.isArray()` before `.find()`
- **DNS**: GoDaddy A records for `mem-ai.chuongdang.com` + `api.mem-ai.chuongdang.com` → droplet IP `165.232.161.85`

## Database Schema (13 tables)

Source of truth: `packages/api/src/db/schema.ts`

`users`, `personalAccessTokens`, `groups`, `groupMembers`, `projects`, `memories` (with vector/768 embedding), `memoryVersions`, `memoryShares`, `sessions`, `sessionEvents`, `connectedRepos`, `repoMemoryFiles`, `auditLogs`, `retentionPolicies`

Key enums: roles (`student`/`admin`), categories (`architecture`/`convention`/`decision`/`preference`/`snippet`/`context`/`other`), agent types (`claude-code`/`gemini-cli`/`cursor`/`kilo-code`/`opencode`/`generic`)

## API (45+ endpoints)

Routes in `packages/api/src/routes/`: `health.ts`, `auth.ts`, `users.ts`, `groups.ts`, `projects.ts`, `memories.ts`, `sessions.ts`, `repos.ts`, `webhooks.ts`, `export.ts`, `admin.ts`

### Key Patterns

- **Auth**: GitHub/Google OAuth → JWT → httpOnly state cookie CSRF. PATs for MCP server (SHA-256 hashed)
- **Middleware**: `authMiddleware` sets `request.userId`, `request.userRole`, `request.userEmail`
- **RBAC**: `requireAdmin()` for admin-only; ownership checks on mutations
- **Embedding**: Save memory first, then try embedding (best-effort). `tryGenerateEmbedding()` in `memory.service.ts`
- **Search**: Hybrid 0.7 vector + 0.3 text with `<=>` cosine distance; falls back to text-only
- **GitHub tokens**: Encrypted with AES-256-GCM before DB storage

## MCP Server (10 tools)

`memory_read`, `memory_write`, `memory_update`, `memory_search`, `memory_delete`, `session_start`, `session_log`, `session_end`, `shared_read`, `project_context`

Auth: `MEMAI_TOKEN` (PAT) + `MEMAI_PROJECT_ID` + `MEMAI_AGENT_TYPE` resolved once on startup.

## Dashboard

Pages: `LoginPage`, `AuthCallbackPage`, `DashboardPage`, `StudentsPage` (admin), `GroupsPage`, `ProjectDetailPage`, `MemoriesPage`, `SessionsPage`, `ReposPage`, `SettingsPage`

Shared state: `UserProvider` + `useUser()` hook. Layout hides admin nav from students.

## Key File Paths

| What | Path |
|---|---|
| DB schema | `packages/api/src/db/schema.ts` |
| Shared types/schemas | `packages/shared/src/{types,validation,constants}.ts` |
| API routes | `packages/api/src/routes/*.ts` |
| Auth (GitHub/Google/JWT/PAT) | `packages/api/src/auth/{github,google,jwt,pat}.ts` |
| Auth middleware | `packages/api/src/middleware/auth.ts` |
| Embedding providers | `packages/api/src/services/embedding/{types,ollama.provider,openai.provider,none.provider}.ts` |
| Embedding facade | `packages/api/src/services/embedding.service.ts` |
| MCP server + tools | `packages/mcp-server/src/{server.ts,tools/*.ts}` |
| Dashboard app | `packages/dashboard/src/App.tsx` |
| User context hook | `packages/dashboard/src/lib/userContext.tsx` |
| CI workflow | `.github/workflows/ci.yml` |
| Deploy workflow | `.github/workflows/deploy.yml` |
| Docker Compose (prod) | `docker-compose.yml` |
| Caddyfile | `Caddyfile` |
| Env template | `.env.example` |
| Test config | `vitest.config.ts` |
| Tests | `packages/shared/src/{validation,constants}.test.ts`, `packages/api/src/auth/pat.test.ts`, `packages/api/src/services/embedding.service.test.ts` |

## Implementation Status

| Phase | Status |
|---|---|
| 1. Foundation (schema, API, MCP, dashboard) | Complete |
| 2. GitHub Integration (repos, webhooks, sync) | Complete |
| 3. Testing & Hardening | In progress — 55 unit tests, need integration tests |
| 4. Deployment (Docker, CI/CD, Caddy, doctl IaC) | Complete — live in production |
| 5. Semantic Search (embeddings, vector search) | Mostly complete — needs HNSW index + tuning |

## Known Gaps

**High**: Integration tests needed (~60+ cases), no HNSW vector index (sequential scan), JWT in OAuth redirect URL query param
**Medium**: Rate limiting global only (100/min), pagination lacks upper bounds
**Low**: `MemoryTimeline`/`SessionViewer` unused, `ShareDialog` needs raw UUID, MCP `ApiClient` uses `any` types, Google OAuth not configured yet

## Code Style

- Follow established patterns — ESM, Drizzle ORM, Zod validation
- `EMBEDDING_PROVIDER=none pnpm test` before considering work complete
- Docs in `docs/ai/` (requirements, design, planning, implementation, testing, deployment)
