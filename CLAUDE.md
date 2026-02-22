# AI DevKit Rules

## Project Context

MemAI — centralizes AI agent memories across coding tools. Thesis students use multiple AI CLIs (Claude Code, Gemini CLI, Cursor, Kilo Code, OpenCode) that each maintain isolated context. MemAI unifies this into a shared memory layer with supervisor oversight via a React dashboard.

### Structure

- `packages/shared` — Shared types, Zod schemas, constants (`@memai/shared`)
- `packages/api` — Fastify 5 REST API + Drizzle ORM + PostgreSQL/pgvector (`@memai/api`)
- `packages/mcp-server` — MCP server npm package for agent CLIs (`memai-mcp`)
- `packages/dashboard` — React 19 + Vite 6 + Tailwind 4 admin dashboard (`@memai/dashboard`)

### Commands

- `pnpm install` — Install all dependencies
- `pnpm build` — Build all packages (via turbo)
- `pnpm dev` — Start dev servers
- `pnpm test` — Run Vitest test suite (55 tests across 4 files)
- `EMBEDDING_PROVIDER=none pnpm test` — Run tests without embedding dependency
- `pnpm test:watch` — Run tests in watch mode
- `pnpm db:generate` — Generate Drizzle migrations
- `pnpm db:migrate` — Run database migrations
- `docker compose -f docker-compose.dev.yml up` — Start Postgres + Ollama for local dev
- `docker compose up` — Start all services (prod)
- `doctl auth init` — Authenticate with DigitalOcean API token
- `doctl compute droplet list` — List VPS instances
- `doctl compute firewall list` — List firewalls
- `doctl compute domain records list <domain>` — List DNS records

### Key Conventions

- All packages use ESM (`"type": "module"`)
- pnpm workspaces + Turborepo for monorepo management
- Database schema source of truth: `packages/api/src/db/schema.ts` (Drizzle ORM)
- Shared Zod validation schemas: `packages/shared/src/validation.ts`
- Embeddings: platform-agnostic via `EmbeddingProviderInterface` (ollama/openai/none), selected by `EMBEDDING_PROVIDER` env var (default: ollama). Provider files in `packages/api/src/services/embedding/`
- Hybrid search: 0.7 vector + 0.3 text scoring with `<=>` cosine distance; falls back to text-only if provider unavailable
- Auth: GitHub/Google OAuth → JWT; PATs for MCP server auth. OAuth CSRF protection via httpOnly state cookie
- GitHub tokens encrypted with AES-256-GCM before storage
- MCP server resolves user context once on startup via `MEMAI_TOKEN` + `MEMAI_PROJECT_ID` + `MEMAI_AGENT_TYPE`
- Hosting: DigitalOcean `s-1vcpu-2gb` droplet in `sgp1` (Singapore), $12/mo. Caddy reverse proxy for auto-HTTPS
- CI/CD: GitHub Actions → GHCR → doctl provisions droplet/firewall → deploy via SSH. CI uses `EMBEDDING_PROVIDER=none`
- Domain: `mem-ai.chuongdang.com` (dashboard), `api.mem-ai.chuongdang.com` (API)
- Testing: Vitest at workspace root, `vitest.config.ts`
- Docker: Ollama uses `profiles: ["ollama"]`, not in api `depends_on`

### Database Schema (13 tables)

Source of truth: `packages/api/src/db/schema.ts`

| Table | Purpose |
|---|---|
| `users` | Accounts (student/admin), OAuth IDs, encrypted GitHub tokens |
| `personalAccessTokens` | SHA-256 hashed PATs for MCP server auth |
| `groups` | Thesis cohorts/student groups |
| `groupMembers` | Group membership (userId + groupId) |
| `projects` | Projects within groups |
| `memories` | Core memory store — title, content, category, tags (jsonb), embedding (vector/768), embedding_model |
| `memoryVersions` | Full version history per memory, `archivedAt` for retention |
| `memoryShares` | Share memories with users/groups (read/write levels) |
| `sessions` | Agent CLI sessions (agent type, start/end, summary) |
| `sessionEvents` | Session event log (message, tool_call, file_edit, decision, error), `archivedAt` for retention |
| `connectedRepos` | GitHub repos linked to projects (webhook ID/secret) |
| `repoMemoryFiles` | Tracked memory files in repos (SHA, agent type, linked memory) |
| `auditLogs` | Action audit trail (userId, action, resource), `archivedAt` for retention |
| `retentionPolicies` | Data retention config per resource type (days, enabled) |

Key enums: roles (`student`/`admin`), categories (`architecture`/`convention`/`decision`/`preference`/`snippet`/`context`/`other`), agent types (`claude-code`/`gemini-cli`/`cursor`/`kilo-code`/`opencode`/`generic`), export formats (`claude-md`/`gemini-md`/`cursorrules`/`skill-md`/`json`/`report`)

### API Routes (45+ endpoints)

Route files in `packages/api/src/routes/`:

| File | Key Endpoints |
|---|---|
| `health.ts` | `GET /api/v1/health` — DB + embedding provider status check |
| `auth.ts` | GitHub/Google OAuth callbacks, JWT, PAT CRUD, token validation |
| `users.ts` | GET/PATCH user, admin list |
| `groups.ts` | Group CRUD, member add/remove |
| `projects.ts` | Project CRUD within groups |
| `memories.ts` | Memory CRUD, search, versions, sharing |
| `sessions.ts` | Session lifecycle, event logging |
| `repos.ts` | GitHub repo list, connect, webhook, file push, sync |
| `webhooks.ts` | `POST /webhooks/github` — HMAC-SHA256 verified push handler |
| `export.ts` | `POST /export` — Export memories to agent-specific format |
| `admin.ts` | System stats, audit logs, retention management, `POST /admin/embeddings/backfill` |

### MCP Server (10 tools)

Defined in `packages/mcp-server/src/server.ts` + `packages/mcp-server/src/tools/`:

`memory_read`, `memory_write`, `memory_update`, `memory_search`, `memory_delete`, `session_start`, `session_log`, `session_end`, `shared_read`, `project_context`

Auth: `MEMAI_TOKEN` (PAT) + `MEMAI_PROJECT_ID` + `MEMAI_AGENT_TYPE` resolved once on startup.

### Dashboard Pages

In `packages/dashboard/src/pages/`:

`LoginPage`, `AuthCallbackPage`, `DashboardPage`, `StudentsPage` (admin), `GroupsPage`, `ProjectDetailPage`, `MemoriesPage`, `SessionsPage`, `ReposPage`, `SettingsPage`

Reusable components: `Layout`, `MemoryTimeline`, `SessionViewer`, `ExportButton`, `ShareDialog`, `RepoConnector`, `PushToRepoButton`, `AuditLog`

Shared state: `UserProvider` + `useUser()` hook (`lib/userContext.tsx`) for auth state. Layout hides admin-only nav from students. All pages have error/loading/empty states and confirmation dialogs on destructive actions.

### Implementation Status

| Phase | Status |
|---|---|
| 1. Foundation (schema, API, MCP, dashboard) | Complete |
| 2. GitHub Integration (repos, webhooks, sync) | Complete |
| 3. Testing & Hardening | In Progress — test infra done (55 unit tests), need integration tests + remaining hardening |
| 4. VPS Deployment (Docker, CI/CD) | Ready — doctl IaC provisioning, Caddy auto-HTTPS, deploy workflow complete |
| 5. Semantic Search (embeddings, vector search) | Mostly complete — embeddings wired, hybrid search done; needs HNSW index + tuning |

### Key File Paths

| What | Path |
|---|---|
| DB schema | `packages/api/src/db/schema.ts` |
| Shared types | `packages/shared/src/types.ts` |
| Zod schemas | `packages/shared/src/validation.ts` |
| Constants/enums | `packages/shared/src/constants.ts` |
| API routes | `packages/api/src/routes/*.ts` |
| Auth middleware | `packages/api/src/middleware/auth.ts` |
| MCP server | `packages/mcp-server/src/server.ts` |
| MCP tools | `packages/mcp-server/src/tools/*.ts` |
| Dashboard app | `packages/dashboard/src/App.tsx` |
| Env template | `.env.example` |
| Design doc | `docs/ai/design/README.md` |
| Planning doc | `docs/ai/planning/README.md` |
| CI workflow | `.github/workflows/ci.yml` |
| Deploy workflow | `.github/workflows/deploy.yml` |
| Caddyfile | `Caddyfile` |
| Pre-launch checklist | `docs/ai/deployment/pre-launch-checklist.md` |
| Embedding providers | `packages/api/src/services/embedding/{types,ollama.provider,openai.provider,none.provider}.ts` |
| Embedding facade | `packages/api/src/services/embedding.service.ts` |
| User context hook | `packages/dashboard/src/lib/userContext.tsx` |
| MCP memory_update | `packages/mcp-server/src/tools/memoryUpdate.ts` |
| Test config | `vitest.config.ts` |
| Test files | `packages/shared/src/{validation,constants}.test.ts`, `packages/api/src/auth/pat.test.ts`, `packages/api/src/services/embedding.service.test.ts` |

This project uses ai-devkit for structured AI-assisted development. Phase documentation is located in `docs/ai/`.

### Key Patterns

- **Auth middleware**: `authMiddleware` sets `request.userId`, `request.userRole`, `request.userEmail`
- **RBAC**: `requireAdmin()` for admin-only endpoints; inline `request.userRole !== "admin"` checks for ownership
- **Ownership checks**: memories (PATCH/DELETE), repos (DELETE), shares (DELETE), session events (POST) all verify ownership
- **Embedding**: Always save memory first, then try embedding (best-effort, try/catch). `tryGenerateEmbedding()` helper in `memory.service.ts`
- **Search fallback**: `searchMemories()` tries hybrid search if provider enabled+available, falls back to `textOnlySearch()`
- **OAuth CSRF**: state stored in httpOnly cookie, validated on callback (both GitHub & Google)
- **Startup validation**: `JWT_SECRET` and `ENCRYPTION_KEY` reject weak defaults in production
- **Project scoping**: `GET /projects` scoped by group membership for students (admins see all)
- **Export access**: students can only export projects they belong to

### Known Gaps

**High**: More integration tests needed (~60+ cases), no HNSW vector index on `memories.embedding` (full sequential scan), JWT passed as URL query param in OAuth redirect
**Medium**: rate limiting is global only (100/min), no per-route limits, pagination params lack upper bound validation
**Low**: `MemoryTimeline`/`SessionViewer` components built but unused, `ShareDialog` requires raw UUID, `(request as any).rawBody` in webhooks.ts, MCP `ApiClient` uses `any` types, no retry/timeout in MCP ApiClient

## Documentation Structure
- `docs/ai/requirements/` - Problem understanding and requirements
- `docs/ai/design/` - System architecture and design decisions (include mermaid diagrams)
- `docs/ai/planning/` - Task breakdown and project planning
- `docs/ai/implementation/` - Implementation guides and notes
- `docs/ai/testing/` - Testing strategy and test cases
- `docs/ai/deployment/` - Deployment and infrastructure docs
- `docs/ai/monitoring/` - Monitoring and observability setup

## Code Style & Standards
- Follow the project's established code style and conventions
- Write clear, self-documenting code with meaningful variable names
- Add comments for complex logic or non-obvious decisions

## Development Workflow
- Review phase documentation in `docs/ai/` before implementing features
- Keep requirements, design, and implementation docs updated as the project evolves
- Reference the planning doc for task breakdown and priorities
- Copy the testing template (`docs/ai/testing/README.md`) before creating feature-specific testing docs

## AI Interaction Guidelines
- When implementing features, first check relevant phase documentation
- For new features, start with requirements clarification
- Update phase docs when significant changes or decisions are made

## Skills (Extend Your Capabilities)
Skills are packaged capabilities that teach you new competencies, patterns, and best practices. Check for installed skills in the project's skill directory and use them to enhance your work.

### Using Installed Skills
1. **Check for skills**: Look for `SKILL.md` files in the project's skill directory
2. **Read skill instructions**: Each skill contains detailed guidance on when and how to use it
3. **Apply skill knowledge**: Follow the patterns, commands, and best practices defined in the skill

### Key Installed Skills
- **memory**: Use AI DevKit's memory service via CLI commands when MCP is unavailable. Read the skill for detailed `memory store` and `memory search` command usage.

### When to Reference Skills
- Before implementing features that match a skill's domain
- When MCP tools are unavailable but skill provides CLI alternatives
- To follow established patterns and conventions defined in skills

## Knowledge Memory (Always Use When Helpful)
The AI assistant should proactively use knowledge memory throughout all interactions.

> **Tip**: If MCP is unavailable, use the **memory skill** for detailed CLI command reference.

### When to Search Memory
- Before starting any task, search for relevant project conventions, patterns, or decisions
- When you need clarification on how something was done before
- To check for existing solutions to similar problems
- To understand project-specific terminology or standards

**How to search**:
- Use `memory.searchKnowledge` MCP tool with relevant keywords, tags, and scope
- If MCP tools are unavailable, use `npx ai-devkit memory search` CLI command (see memory skill for details)
- Example: Search for "authentication patterns" when implementing auth features

### When to Store Memory
- After making important architectural or design decisions
- When discovering useful patterns or solutions worth reusing
- If the user explicitly asks to "remember this" or save guidance
- When you establish new conventions or standards for the project

**How to store**:
- Use `memory.storeKnowledge` MCP tool
- If MCP tools are unavailable, use `npx ai-devkit memory store` CLI command (see memory skill for details)
- Include clear title, detailed content, relevant tags, and appropriate scope
- Make knowledge specific and actionable, not generic advice

### Memory Best Practices
- **Be Proactive**: Search memory before asking the user repetitive questions
- **Be Specific**: Store knowledge that's actionable and reusable
- **Use Tags**: Tag knowledge appropriately for easy discovery (e.g., "api", "testing", "architecture")
- **Scope Appropriately**: Use `global` for general patterns, `project:<name>` for project-specific knowledge

## Testing & Quality
- Vitest at workspace root (`vitest.config.ts`), 55 tests passing across 4 files
- Run tests: `EMBEDDING_PROVIDER=none pnpm test` (avoids Ollama dependency)
- Write tests alongside implementation
- Follow the testing strategy defined in `docs/ai/testing/`
- Use `/writing-test` to generate unit and integration tests targeting 100% coverage
- Ensure code passes all tests before considering it complete

## Documentation
- Update phase documentation when requirements or design changes
- Keep inline code comments focused and relevant
- Document architectural decisions and their rationale
- Use mermaid diagrams for any architectural or data-flow visuals (update existing diagrams if needed)
- Record test coverage results and outstanding gaps in `docs/ai/testing/`

## Key Commands
When working on this project, you can run commands to:
- Understand project requirements and goals (`review-requirements`)
- Review architectural decisions (`review-design`)
- Plan and execute tasks (`execute-plan`)
- Verify implementation against design (`check-implementation`)
- Writing tests (`writing-test`)
- Perform structured code reviews (`code-review`)
