---
phase: requirements
title: Requirements & Problem Understanding
description: Clarify the problem space, gather requirements, and define success criteria
---

# Requirements & Problem Understanding

## Problem Statement

Thesis students use multiple AI coding CLIs (Claude Code, Gemini CLI, Cursor, Kilo Code, OpenCode) during their projects. Each tool maintains its own siloed memory file (e.g. `CLAUDE.md`, `GEMINI.md`, `.cursorrules`), leading to:

- **Fragmented knowledge**: Decisions recorded in one agent are invisible to others. A student using Claude Code to define an architecture decision must manually replicate it in Cursor rules.
- **No supervisor visibility**: Supervisors have no way to see what guidance students have stored, what sessions they've run, or how agents are being used across the group.
- **Lost context on tool switch**: When a student switches from one AI CLI to another, all accumulated project context starts from zero.
- **No sharing across students**: Students in the same thesis group cannot share useful patterns or decisions discovered during their work.

**Who is affected?**
- **Thesis students** who use AI coding assistants daily and lose productivity to context fragmentation.
- **Supervisors/admins** who need oversight of student AI usage and want to guide best practices.

**Current workarounds**: Students manually copy-paste between memory files. Supervisors periodically check in during meetings with no tooling support.

## Goals & Objectives

### Primary Goals
1. **Centralize AI agent memories** in a single PostgreSQL database accessible via REST API
2. **Cross-agent sync via MCP**: Any MCP-compatible agent CLI can read/write memories through a standard protocol server
3. **Admin oversight dashboard**: Supervisors can view all student activity, memories, and sessions in a web UI
4. **GitHub repo integration**: Automatically import agent memory files (CLAUDE.md, .cursorrules, etc.) from connected repositories via webhooks

### Secondary Goals
5. **Memory sharing**: Students can share individual memories with peers or entire groups
6. **Version history**: Track all changes to memories with full version trail and change reasons
7. **Session tracking**: Log agent sessions with events for audit and analysis
8. **Semantic search**: Find relevant memories using vector embeddings (pgvector + Ollama)
9. **Export to agent formats**: Export project memories back to CLAUDE.md, GEMINI.md, .cursorrules, etc.
10. **Audit logging**: Record all significant actions for compliance and debugging

### Non-Goals
- **Real-time collaboration**: No live co-editing of memories or presence indicators
- **Agent runtime hosting**: MemAI does not run or proxy AI agents; it only stores their memories
- **Billing/payments**: No subscription or usage-based billing; this is an internal/academic tool
- **Mobile app**: Dashboard is web-only; no native mobile client planned
- **Multi-tenant SaaS**: Single deployment for one institution/group; no tenant isolation needed

## User Stories & Use Cases

### Supervisor (Admin)
- As a supervisor, I want to **create groups and add students** so that I can organize thesis cohorts
- As a supervisor, I want to **assign projects to groups** so that student work is organized by topic
- As a supervisor, I want to **view all memories across my students' projects** so that I can see what guidance they've stored
- As a supervisor, I want to **view session logs** so that I can understand how students are using AI tools
- As a supervisor, I want to **see system-wide statistics** (user count, memory count, active sessions) on a dashboard
- As a supervisor, I want to **view audit logs** so that I can track who did what and when
- As a supervisor, I want to **export all memories for a group or project** so that I can review or archive student work
- As a supervisor, I want to **promote a student to admin** so that trusted students can help manage the system
- As a supervisor, I want to **configure data retention policies** so that high-volume tables don't exhaust disk space
- As a supervisor, I want to **revoke a student's shared memory** if it contains inappropriate content

### Student
- As a student, I want to **store memories via my AI CLI** (Claude Code, Gemini CLI, etc.) using the MCP server so that my knowledge persists across sessions
- As a student, I want to **search my memories by keyword or semantically** so that I can find relevant context quickly
- As a student, I want to **connect my GitHub repo** so that agent memory files are automatically synced to MemAI
- As a student, I want to **share a memory with my thesis group** so that useful patterns are available to peers
- As a student, I want to **revoke a previously shared memory** so that I can control access to my knowledge
- As a student, I want to **export my project memories** to CLAUDE.md or .cursorrules format so that I can bootstrap a new repo
- As a student, I want to **create a Personal Access Token (PAT)** so that my MCP server can authenticate without re-doing OAuth each session
- As a student, I want to **list and delete my PATs** so that I can manage active tokens and revoke compromised ones
- As a student, I want to **view my session history** so that I can review past AI interactions
- As a student, I want to **view a memory's version history** so that I can see how it changed over time
- As a student, I want to **edit or delete a memory from the dashboard** so that I can correct mistakes without using the CLI
- As a student, I want to **pin important memories** so that they appear first in exports and searches
- As a student, I want to **disconnect a GitHub repo** so that I can stop syncing when a project ends

### MCP Agent (Machine)
- As an MCP client, I want to **write a memory** with title, content, category, and tags
- As an MCP client, I want to **read memories** by ID, category, or list all
- As an MCP client, I want to **search memories** by text query
- As an MCP client, I want to **delete a memory** by ID
- As an MCP client, I want to **start/log/end a session** to track the current interaction
- As an MCP client, I want to **read shared memories** to access group knowledge
- As an MCP client, I want to **get project context** (stats, recent memories) for orientation
- As an MCP client, I want to **receive structured error responses** on invalid input so that the agent can surface clear messages to the user

## Success Criteria

| Criterion | Target |
|---|---|
| Memory write → read round-trip latency | < 500ms (excluding embedding generation) |
| Memory CRUD API response time | < 200ms for non-search operations |
| MCP server startup (auth + context resolution) | < 2s |
| Agent memory file auto-import from connected repos | All recognized non-wildcard patterns (CLAUDE.md, GEMINI.md, .cursorrules, etc.) detected and imported |
| Dashboard page load time | < 3s for any page |
| Dashboard shows all student activity | Memories, sessions, repos, audit logs visible to admins |
| Semantic search returns relevant results | Top-5 results include the expected memory for a related query (precision@5 ≥ 0.6) |
| Export produces valid agent files | Exported CLAUDE.md/cursorrules are loadable by their respective tools |
| Zero plaintext secrets in database | GitHub tokens encrypted with AES-256-GCM; PATs stored as SHA-256 hashes only; raw PAT returned once on creation, never persisted |
| API uptime | 99% (single VPS, acceptable for academic use); downtime = API health endpoint unreachable |
| Concurrent users | Support 10–50 concurrent users without degradation |
| Audit log coverage | All write operations (create, update, delete) on core resources are logged |
| Webhook processing | Idempotent; duplicate deliveries produce no duplicate data |

## Constraints & Assumptions

### Technical Constraints
- **Single Digital Ocean VPS**: All services (Postgres, Ollama, API, Dashboard) run on one machine via Docker Compose
- **Local Ollama only**: Embedding generation uses Ollama with `nomic-embed-text` model (768-dim vectors) to avoid external API costs
- **ESM-only**: All packages use `"type": "module"` — no CommonJS
- **pnpm workspaces + Turborepo**: Monorepo management is locked to this toolchain
- **PostgreSQL + pgvector**: Vector search is co-located with relational data; no separate vector DB

### Business Constraints
- **No external API costs**: No OpenAI/Anthropic API calls for embeddings or processing
- **Academic context**: Users are thesis students and supervisors; no commercial SLA
- **Single institution deployment**: One instance serves one group/department

### Assumptions
- Students have GitHub accounts and repos with standard agent memory file patterns
- MCP protocol is supported by target AI CLIs (Claude Code, Gemini CLI confirmed; others via generic)
- VPS has sufficient RAM for Ollama (minimum 4GB recommended for nomic-embed-text)
- OAuth providers (GitHub, Google) remain available and free for academic use
- Expected user base: 10–50 students per institution deployment
- Users access the dashboard from modern browsers (Chrome, Firefox, Safari, Edge — latest 2 versions)
- Students self-register via OAuth; admin role is assigned by an existing admin

## Non-Functional Requirements

### Security
- **Secrets at rest**: GitHub OAuth tokens encrypted with AES-256-GCM; PATs stored as SHA-256 hashes only. Raw PAT value returned once on creation and never persisted or logged.
- **Input validation**: All API request bodies validated with Zod schemas at route boundaries. Memory content is stored as-is (no HTML rendering) to prevent XSS.
- **CORS**: Only the dashboard origin is allowed in production (`CORS_ORIGIN` env var).
- **TLS/HTTPS**: Enforced in production via reverse proxy (nginx). API and dashboard served over HTTPS only.
- **JWT lifecycle**: 7-day expiry; no refresh tokens. Expired sessions redirect to login. No early invalidation mechanism in v1.
- **Webhook verification**: GitHub webhook signatures must be verified via HMAC-SHA256 with constant-time comparison on every request. Requests without valid signatures must be rejected.
- **Audit trail**: All write operations (create, update, delete) on core resources (memories, sessions, groups, projects, repos, users) are recorded in the audit log with userId, action, resource type, resource ID, and IP address.

### Performance
- **API response time**: < 200ms for CRUD operations (excluding embedding generation). < 500ms for search with embedding.
- **Embedding generation**: < 2s per memory via Ollama. Embedding is asynchronous — memory creation succeeds immediately, embedding is generated as an enhancement.
- **Dashboard page load**: < 3s for any page with up to 1000 items in a list.
- **Rate limiting**: 100 requests/minute global. Per-user rate limiting is deferred to v2 if fairness issues arise.

### Scalability
- **Single VPS deployment**: Vertical scaling only. No horizontal scaling or multi-replica support in v1.
- **Database growth**: High-volume tables managed by data retention policies (soft-delete + archival). See `feature-data-retention.md`.
- **Expected data volume**: ~50 students, ~2.6M session events/year, ~130K memory versions/year, ~500K audit log entries/year.

### Reliability
- **Uptime target**: 99% (single VPS, acceptable for academic use). Downtime defined as API health endpoint (`GET /api/v1/health`) returning non-200.
- **Recovery**: Docker `restart: always` policy. VPS restart recovers all services automatically.
- **Database backups**: Daily automated backups via VPS provider snapshots. RPO ≤ 24 hours.
- **Graceful degradation**: If Ollama is unavailable, memory operations continue without embedding generation. Semantic search falls back to text-only search.

### Observability
- **Structured logging**: Fastify pino JSON logs with request ID, method, URL, status, and response time.
- **Health endpoint**: `GET /api/v1/health` checks DB connectivity and Ollama availability.
- **Audit log**: Queryable via admin API and dashboard for compliance and debugging.
- **Retention stats**: Admin can view active vs archived row counts per managed table.

## Questions & Open Items

- **Ollama RAM on small VPS**: Will `nomic-embed-text` run reliably on a 4GB VPS alongside Postgres and the API? May need to make embeddings optional or use a smaller model.
- **OAuth token refresh**: GitHub OAuth tokens may expire; need a refresh flow or re-auth prompt.
- **Webhook reliability**: GitHub webhook delivery is best-effort; need idempotent processing and manual re-sync as fallback.
- **Rate limiting per user vs global**: Current rate limit is 100 req/min globally; may need per-user limits for fairness.
- **PAT expiry in running MCP servers**: When a PAT expires while an MCP server is running, the server will fail on next API call. Need clear error messaging for this scenario.
- **GitHub token expiry mid-session**: If a student's GitHub OAuth token expires while webhooks are active, push event processing may fail. Need a re-auth notification mechanism.
- **Memory ownership on group change**: When a student leaves a group/project, what happens to their memories? Currently they remain — need to decide if they should be transferred or removed.
- **Webhook + MCP write conflict**: When both a webhook push and a manual MCP write modify the same memory file simultaneously, which takes precedence?
