---
phase: implementation
title: Implementation Guide
description: Technical implementation notes, patterns, and code guidelines
---

# Implementation Guide

## Development Setup

### Prerequisites
- **Node.js 22** (LTS)
- **pnpm 9** (`corepack enable && corepack prepare pnpm@9.15.4`)
- **Docker + Docker Compose** (for Postgres + Ollama)

### Steps

1. **Clone and install**
   ```bash
   git clone <repo-url> && cd mem-ai
   pnpm install
   ```

2. **Start local services**
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```
   This starts:
   - PostgreSQL 16 with pgvector on port `5432` (user: `memai`, password: `devpassword`, db: `memai`)
   - Ollama on port `11434`

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your GitHub/Google OAuth credentials, JWT secret, encryption key
   ```

   Required env vars:
   | Variable | Description | Example |
   |---|---|---|
   | `DB_PASSWORD` | Postgres password | `devpassword` |
   | `GITHUB_CLIENT_ID` | GitHub OAuth App ID | `Iv1.abc123` |
   | `GITHUB_CLIENT_SECRET` | GitHub OAuth App secret | `secret_xyz` |
   | `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123.apps.googleusercontent.com` |
   | `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-xxx` |
   | `JWT_SECRET` | Secret for signing JWTs | Random 64-char string |
   | `ENCRYPTION_KEY` | AES-256 key for token encryption | 64 hex chars (32 bytes) |
   | `VITE_API_URL` | API URL for dashboard | `http://localhost:3000` |
   | `OLLAMA_URL` | Ollama endpoint | `http://localhost:11434` |
   | `EMBEDDING_MODEL` | Ollama model name | `nomic-embed-text` |

4. **Generate and run migrations**
   ```bash
   pnpm db:generate    # Generate Drizzle migrations from schema
   pnpm db:migrate     # Apply migrations to database
   ```

5. **Seed the database** (optional)
   ```bash
   pnpm db:seed        # Creates admin user, demo group, demo project
   ```

6. **Start dev servers**
   ```bash
   pnpm dev            # Starts API (port 3000) + Dashboard (port 5173) via Turborepo
   ```

## Code Structure

```
mem-ai/
├── packages/
│   ├── shared/                    # @memai/shared - types, schemas, constants
│   │   └── src/
│   │       ├── index.ts           # Re-exports
│   │       ├── constants.ts       # Agent types, categories, patterns, roles
│   │       └── validation.ts      # 20+ Zod schemas for all API operations
│   │
│   ├── api/                       # @memai/api - Fastify REST API
│   │   └── src/
│   │       ├── index.ts           # Server bootstrap, CORS, rate limiting, routes
│   │       ├── db/
│   │       │   ├── schema.ts      # Drizzle ORM schema (13 tables + relations)
│   │       │   ├── index.ts       # Database connection (postgres.js driver)
│   │       │   ├── migrate.ts     # Migration runner
│   │       │   └── seed.ts        # Seed data (admin user, demo group/project)
│   │       ├── routes/
│   │       │   ├── health.ts      # GET /health (DB + Ollama check)
│   │       │   ├── auth.ts        # OAuth flows, JWT, PAT management (9 endpoints)
│   │       │   ├── users.ts       # User CRUD (3 endpoints)
│   │       │   ├── groups.ts      # Group + member management (6 endpoints)
│   │       │   ├── projects.ts    # Project CRUD (5 endpoints)
│   │       │   ├── memories.ts    # Memory CRUD, search, versions, sharing (11 endpoints)
│   │       │   ├── sessions.ts    # Session lifecycle + events (6 endpoints)
│   │       │   ├── repos.ts       # GitHub repo connection + sync (7 endpoints)
│   │       │   ├── webhooks.ts    # GitHub push webhook handler (1 endpoint)
│   │       │   ├── export.ts      # Memory export to agent formats (1 endpoint)
│   │       │   └── admin.ts       # System stats + audit logs (2 endpoints)
│   │       ├── middleware/
│   │       │   ├── auth.ts        # JWT + PAT authentication
│   │       │   ├── rbac.ts        # Role-based access control
│   │       │   └── audit.ts       # Audit log recording
│   │       ├── auth/
│   │       │   ├── jwt.ts         # JWT sign/verify (jsonwebtoken)
│   │       │   └── pat.ts         # PAT generation (nanoid) + SHA-256 hashing
│   │       └── services/
│   │           └── github.service.ts  # Token encryption, webhook verification, GitHub API
│   │
│   ├── mcp-server/                # memai-mcp - MCP server npm package
│   │   └── src/
│   │       ├── bin/
│   │       │   └── memai-mcp.ts   # CLI entry point (resolves MEMAI_TOKEN + MEMAI_PROJECT_ID)
│   │       ├── server.ts          # 9 MCP tools (memory CRUD, sessions, sharing, context)
│   │       └── api-client.ts      # HTTP client for MemAI REST API
│   │
│   └── dashboard/                 # @memai/dashboard - React SPA
│       └── src/
│           ├── App.tsx            # Router (10 routes: login, callback, dashboard, etc.)
│           ├── pages/             # Page components
│           ├── components/        # Reusable UI components
│           └── contexts/          # Auth context (JWT management)
│
├── docker-compose.yml             # Production (4 services)
├── docker-compose.dev.yml         # Development (Postgres + Ollama only)
├── turbo.json                     # Turborepo pipeline config
├── pnpm-workspace.yaml            # Workspace package list
└── .github/workflows/
    ├── ci.yml                     # Build, test, push Docker images
    └── deploy.yml                 # SSH deploy to VPS
```

## Implementation Notes

### Core Patterns

#### Zod Validation at Route Boundaries
All incoming request bodies are validated with Zod schemas from `@memai/shared` before reaching business logic. Invalid requests return 400 with structured error details.

```typescript
// Example pattern in route handlers
const body = createMemorySchema.parse(request.body);
```

Global error handler in `src/index.ts` catches `ZodError` and formats it:
```typescript
if (error instanceof ZodError) {
  reply.status(400).send({ error: "Validation error", details: error.errors });
}
```

#### Drizzle Query Builder
Queries use Drizzle's SQL-like builder — no raw SQL strings. Relations are declared separately from tables and used with `query` API for eager loading.

```typescript
// Example: fetch project with related memories and sessions
const project = await db.query.projects.findFirst({
  where: eq(projects.id, projectId),
  with: { memories: true, sessions: true },
});
```

#### Version Tracking on Memory Mutations
When a memory is updated, the previous state is saved to `memoryVersions` and the `version` counter is incremented. This provides a full audit trail of how memories evolve over time.

#### Service Layer Between Routes and DB
GitHub-related operations are encapsulated in `github.service.ts`, keeping route handlers thin. Token encryption/decryption, webhook signature verification, and GitHub API calls are all in the service layer.

### Memory File Patterns
The system recognizes these agent memory file patterns in connected repos:

| Pattern | Agent Type |
|---|---|
| `CLAUDE.md`, `.claude/CLAUDE.md` | `claude-code` |
| `GEMINI.md`, `.gemini/GEMINI.md` | `gemini-cli` |
| `.cursorrules` | `cursor` |
| `.kilocode/rules/**/*.md` | `kilo-code` |
| `MEMORY.md`, `memory.md` | `generic` |

## Integration Points

### Ollama Embedding API
- **Endpoint**: `POST ${OLLAMA_URL}/api/embed`
- **Model**: `nomic-embed-text` (768-dimensional vectors)
- **Usage**: Called when creating/updating memories to generate embedding vectors
- **Fallback**: If Ollama is unreachable, memory is saved without embedding (text search still works)

### GitHub REST API
- **Authentication**: User's encrypted OAuth token, decrypted per-request
- **Operations**:
  - List user repositories (`GET /user/repos`)
  - Read file contents (`GET /repos/:owner/:repo/contents/:path`)
  - Create/update files (`PUT /repos/:owner/:repo/contents/:path`)
  - Create webhooks (`POST /repos/:owner/:repo/hooks`)
  - Delete webhooks (`DELETE /repos/:owner/:repo/hooks/:id`)
- **Library**: `octokit` v4

### GitHub Webhooks
- **Event**: `push` events on connected repos
- **Verification**: HMAC-SHA256 signature in `X-Hub-Signature-256` header
- **Processing**: Parse changed files, check against memory file patterns, import/update matching files
- **Async**: File processing happens after webhook response (non-blocking)

### OAuth Token Exchange
- **GitHub**: `code` → `POST https://github.com/login/oauth/access_token` → access token → encrypt → store
- **Google**: `code` → `POST https://oauth2.googleapis.com/token` → access token → fetch user info → upsert user

## Error Handling

### Strategy
- **Validation errors** (ZodError): 400 with field-level details
- **Authentication errors**: 401 with generic message (no information leakage)
- **Authorization errors**: 403 with role requirement
- **Not found**: 404 with resource type
- **Server errors**: 500 with generic message; details logged server-side

### Logging
- **Library**: Fastify's built-in Pino logger (structured JSON)
- **Log level**: Configured via `LOG_LEVEL` env var (default: `info`)
- **Request logging**: Fastify auto-logs request/response with timing

## Performance Considerations

### Database Indexes
Key indexes defined in schema:
- `idx_memories_project` — filter memories by project
- `idx_memories_user` — filter memories by user
- `idx_memory_versions_memory` — fetch version history
- `idx_sessions_project` / `idx_sessions_user` — filter sessions
- `idx_session_events_session` — fetch session events
- `idx_connected_repos_user` — list user's repos
- `idx_repo_files_repo` — list repo's tracked files
- `idx_audit_logs_user` — filter audit by user

### Rate Limiting
- Global: 100 requests per minute via `@fastify/rate-limit`
- Applied to all routes

### Query Optimization
- Drizzle generates parameterized queries (no SQL injection, efficient plan caching)
- Relations loaded with `with` clause (avoids N+1 via joins)
- Pagination via `limit` + `offset` on list endpoints

## Security Notes

### Authentication Flow
1. **Dashboard login**: User clicks GitHub/Google OAuth → redirected to provider → callback with code → API exchanges for token → API issues JWT → stored in browser
2. **MCP auth**: User creates PAT in dashboard → sets `MEMAI_TOKEN` env var → MCP server sends PAT as Bearer token → API hashes and looks up in DB

### Token Security
- **JWT**: Signed with `JWT_SECRET` (HS256), 7-day expiry, payload: `{sub, email, role}`
- **PAT**: Format `memai_<64hex>`, stored as SHA-256 hash only (raw token never persisted)
- **GitHub tokens**: Encrypted with AES-256-GCM before storage. Format: `${iv}:${authTag}:${ciphertext}`

### Webhook Security
- Each connected repo has a unique `webhookSecret` (generated on connect)
- Incoming webhooks verified with HMAC-SHA256 using `crypto.timingSafeEqual()` (constant-time comparison)

### Input Validation
- All request bodies validated with Zod schemas
- UUID format enforced on all ID parameters
- String length limits on all text fields
- Array size limits on tags (max 20 tags, max 50 chars each)

### Secrets Management
- Secrets stored in GitHub Actions secrets for CI/CD
- `.env` file for local development (gitignored)
- `ENCRYPTION_KEY` must be 64 hex chars (32 bytes) — validated at startup
