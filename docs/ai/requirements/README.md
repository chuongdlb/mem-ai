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
- As a supervisor, I want to **view all memories across my students' projects** so that I can see what guidance they've stored
- As a supervisor, I want to **view session logs** so that I can understand how students are using AI tools
- As a supervisor, I want to **see system-wide statistics** (user count, memory count, active sessions) on a dashboard
- As a supervisor, I want to **view audit logs** so that I can track who did what and when

### Student
- As a student, I want to **store memories via my AI CLI** (Claude Code, Gemini CLI, etc.) using the MCP server so that my knowledge persists across sessions
- As a student, I want to **search my memories by keyword or semantically** so that I can find relevant context quickly
- As a student, I want to **connect my GitHub repo** so that agent memory files are automatically synced to MemAI
- As a student, I want to **share a memory with my thesis group** so that useful patterns are available to peers
- As a student, I want to **export my project memories** to CLAUDE.md or .cursorrules format so that I can bootstrap a new repo
- As a student, I want to **create a Personal Access Token (PAT)** so that my MCP server can authenticate without re-doing OAuth each session
- As a student, I want to **view my session history** so that I can review past AI interactions

### MCP Agent (Machine)
- As an MCP client, I want to **write a memory** with title, content, category, and tags
- As an MCP client, I want to **read memories** by ID, category, or list all
- As an MCP client, I want to **search memories** by text query
- As an MCP client, I want to **delete a memory** by ID
- As an MCP client, I want to **start/log/end a session** to track the current interaction
- As an MCP client, I want to **read shared memories** to access group knowledge
- As an MCP client, I want to **get project context** (stats, recent memories) for orientation

## Success Criteria

| Criterion | Target |
|---|---|
| Memory write → read round-trip latency | < 500ms |
| MCP server startup (auth + context resolution) | < 2s |
| Agent memory file auto-import from connected repos | All recognized patterns (CLAUDE.md, GEMINI.md, .cursorrules, etc.) detected and imported |
| Dashboard shows all student activity | Memories, sessions, repos, audit logs visible to admins |
| Semantic search returns relevant results | Top-5 results include the expected memory for a related query |
| Export produces valid agent files | Exported CLAUDE.md/cursorrules are loadable by their respective tools |
| Zero plaintext secrets in database | GitHub tokens encrypted with AES-256-GCM; PATs stored as SHA-256 hashes only |
| API uptime | 99% (single VPS, acceptable for academic use) |

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

## Questions & Open Items

- **Ollama RAM on small VPS**: Will `nomic-embed-text` run reliably on a 4GB VPS alongside Postgres and the API? May need to make embeddings optional or use a smaller model.
- **OAuth token refresh**: GitHub OAuth tokens may expire; need a refresh flow or re-auth prompt.
- **Webhook reliability**: GitHub webhook delivery is best-effort; need idempotent processing and manual re-sync as fallback.
- **Rate limiting per user vs global**: Current rate limit is 100 req/min globally; may need per-user limits for fairness.
