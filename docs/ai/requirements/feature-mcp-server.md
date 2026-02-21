---
phase: requirements
title: MCP Server — Requirements
description: Requirements for the MCP server package enabling AI agent CLIs to share a unified memory layer
---

# MCP Server — Requirements

## Problem Statement

Thesis students use multiple AI coding agents (Claude Code, Gemini CLI, Cursor, Kilo Code, OpenCode) that each maintain their own isolated context. When a student switches between agents or starts a new session, prior decisions, conventions, and architecture notes are lost. There is no standard way for these agents to read from and write to a shared memory layer, nor to track session activity for supervisor review.

The Model Context Protocol (MCP) provides a standardized interface for AI agents to call external tools. MemAI's MCP server exposes memory and session management as MCP tools so that any MCP-compatible agent can participate in the shared memory layer without custom integration per agent.

**Who is affected?**
- **Students**: Benefit from cross-agent memory continuity — a decision recorded by Claude Code is immediately available to Gemini CLI
- **AI agents**: Need a simple, tool-based interface to read, write, search, and delete memories, and to manage sessions
- **Admins/Supervisors**: Gain visibility into agent sessions and memory changes across all students via the dashboard

**Current workarounds**: Without the MCP server, agents would have no programmatic access to MemAI. Students would need to manually copy context between agents.

## Goals & Objectives

### Primary Goals
1. **9 MCP tools** covering memory CRUD, session lifecycle, shared memory access, and project context retrieval
2. **One-time startup authentication** — validate `MEMAI_TOKEN` (PAT) and resolve `MEMAI_PROJECT_ID` once on server initialization, caching the user identity for all subsequent tool calls
3. **Stdio transport** for seamless integration with AI agent CLIs that launch the MCP server as a child process
4. **npm package distribution** (`memai-mcp`) with a `bin` entry so agents can run the server via `npx memai-mcp`

### Secondary Goals
5. **Zod schema validation** on all tool inputs, with descriptive parameter metadata for agent tool-use prompting
6. **Stateless tool handlers** that delegate all business logic to the MemAI REST API via an HTTP client (`ApiClient`)
7. **Structured text responses** returned as MCP `text` content blocks for agent consumption

### Non-Goals
- **Session auto-close on process exit**: If the MCP server process is terminated (e.g., agent CLI exits), any open session is not automatically ended. The session remains in an `endedAt = null` state. This is a known gap.
- **Rate limiting at the MCP layer**: The MCP server does not enforce rate limits. Any rate limiting is handled by the upstream REST API.
- **Streaming or SSE transport**: Only stdio transport is supported. HTTP/SSE-based MCP transport is not implemented.
- **Tool-level authorization**: All tools are available to any authenticated user. There is no per-tool role restriction (e.g., admin-only tools).
- **Offline mode or local caching**: The MCP server is a thin client. If the MemAI API is unreachable, all tool calls fail.

## User Stories & Use Cases

### Student (via AI Agent)
- As a student using Claude Code, I want the agent to **read my project memories** so it has full context about architecture decisions and conventions before starting work.
- As a student, I want the agent to **write new memories** (e.g., "decided to use Fastify over Express") so that the decision is available to all my agents.
- As a student, I want the agent to **search memories by keyword** so it can find relevant context without loading everything.
- As a student, I want the agent to **delete outdated memories** that no longer reflect the project state.
- As a student, I want the agent to **start a session** when I begin work, **log events** (messages, tool calls, file edits, decisions, errors) during the session, and **end the session** with a summary so my supervisor can review my workflow.
- As a student, I want to **read shared memories** from teammates or supervisors so I can align with group-wide conventions.
- As a student, I want to **get project context** (name, description, memory count, session count) so the agent understands the project at a glance.

### Agent (System)
- As an MCP-compatible agent, I launch the MCP server as a subprocess and communicate via **stdin/stdout** using the MCP protocol.
- As the MCP server, I **validate the PAT once on startup** and cache the user identity. If validation fails, the process exits with an error.
- As the MCP server, I **resolve `MEMAI_PROJECT_ID`** on startup so that tool handlers don't need the project ID as a parameter (it's injected from the cached context).

## Success Criteria

| Criterion | Target |
|---|---|
| All 9 tools registered | `memory_read`, `memory_write`, `memory_search`, `memory_delete`, `session_start`, `session_log`, `session_end`, `shared_read`, `project_context` |
| Startup auth validation | `GET /api/v1/auth/validate` called once; process exits on failure |
| Project ID required | `MEMAI_PROJECT_ID` must be set; startup fails if missing |
| Tool input validation | All tool parameters validated via Zod schemas before API calls |
| Stdio transport works | Server communicates over stdin/stdout using `StdioServerTransport` |
| npm binary works | `npx memai-mcp` launches the server (bin entry: `memai-mcp` -> `dist/bin/memai-mcp.js`) |
| API errors surfaced | Non-2xx responses from the API are thrown as errors with status code and response body |
| Memory tools scope to project | `memory_read`, `memory_write`, `memory_search` automatically use the cached project ID |
| Session events typed | `session_log` accepts typed events: `message`, `tool_call`, `file_edit`, `decision`, `error` |

## Tool Reference

| Tool | Parameters | Description |
|---|---|---|
| `memory_read` | `memoryId?` (uuid), `category?` (string), `limit?` (1-50, default 10) | Read a specific memory by ID or list memories, optionally filtered by category |
| `memory_write` | `title` (1-500 chars), `content` (string), `category?` (default "other"), `tags?` (string[]) | Create a new memory in the project |
| `memory_search` | `query` (string), `category?` (string), `limit?` (1-50, default 10) | Search memories by text query within the project |
| `memory_delete` | `memoryId` (uuid) | Delete a memory by ID |
| `session_start` | `agentType` (string), `title?` (string) | Start a new session; returns session ID for subsequent calls |
| `session_log` | `sessionId` (uuid), `eventType` (enum), `content` (string), `metadata?` (object) | Log an event to an active session |
| `session_end` | `sessionId` (uuid), `summary?` (string) | End a session with an optional summary |
| `shared_read` | (none) | Read all memories shared with the current user (directly or via groups) |
| `project_context` | (none) | Get project overview: name, description, group, memory count, session count |

## Constraints & Assumptions

### Business Constraints
- **npm distribution**: The MCP server is published as `memai-mcp` on npm. Users install it globally or run it via `npx`. This requires the package to be publicly available on the npm registry.
- **Agent-agnostic**: The MCP server does not know or care which agent is calling it. The `agentType` field in `session_start` is self-reported by the agent.

### Technical Constraints
- **Stdio-only transport**: The server uses `StdioServerTransport`, which means the agent must launch it as a child process. Agents that communicate over HTTP/SSE (e.g., remote MCP servers) are not supported.
- **No session cleanup on exit**: The MCP server process does not register `SIGTERM`/`SIGINT` handlers to end open sessions. If the agent CLI is killed, the session remains open. A cleanup mechanism (e.g., session timeout or supervisor manual close) is needed.
- **Thin client architecture**: The MCP server contains zero business logic. All operations are HTTP calls to the REST API. This means the API must be reachable, and network latency affects tool response times.
- **No retry logic**: The `ApiClient` does not retry failed requests. Transient network errors cause tool failures.
- **Token cached in memory**: The validated user identity is stored in module-level variables (`cachedUser`, `projectId`). This is fine for a single-process server but means the token cannot be rotated without restarting the process.
- **No tool-level error recovery**: If an API call fails (e.g., 404 for a deleted memory), the error propagates to the agent as a thrown exception. The MCP SDK translates this into an error response. There is no tool-level retry or fallback.

### Assumptions
- The MemAI API server is running and reachable at `MEMAI_API_URL` (defaults to `http://localhost:3000`).
- `MEMAI_TOKEN` is a valid, non-expired PAT. If the token expires or is deleted while the server is running, subsequent tool calls will fail with 401 errors.
- `MEMAI_PROJECT_ID` is a valid UUID corresponding to a project the user has access to.
- Agents call `session_start` at the beginning of a work session and `session_end` when done. There is no enforcement of this lifecycle at the MCP layer.
- Response payloads (memories, sessions) are JSON-serialized as text content. Agents are expected to parse JSON from the text content blocks.

## Questions & Open Items

- **Session auto-close**: Should the MCP server register a `SIGTERM`/`SIGINT` handler to call `session_end` for any open session before exiting? This would require tracking the active session ID in the server state.
- **Rate limiting**: Should the MCP server enforce per-tool rate limits to prevent runaway agents from flooding the API? Or is API-level rate limiting sufficient?
- **Agent type detection**: Currently `agentType` is a parameter to `session_start`. Should the MCP server auto-detect the agent type from the parent process or environment, removing the need for agents to self-report?
- **Memory update support**: The MCP server has `memory_write` (create) and `memory_delete` but no `memory_update` tool. Should an update tool be added so agents can modify existing memories without deleting and recreating?
- **Error formatting**: Should tool errors return structured error objects (e.g., `{ error: "not_found", memoryId: "..." }`) instead of raw exception messages, to help agents handle failures programmatically?
- **Health check tool**: Should the MCP server expose a health/ping tool so agents can verify connectivity without performing a real operation?
