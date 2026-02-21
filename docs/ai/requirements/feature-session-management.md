---
phase: requirements
title: Session Management — Requirements
description: Requirements for centralized agent session tracking and event logging with supervisor visibility
---

# Session Management — Requirements

## Problem Statement

When students use AI coding agents (Claude Code, Gemini CLI, Cursor, etc.), each interaction session generates valuable context — decisions made, tools called, files edited, errors encountered. Without centralized session tracking, this context is lost when the agent session closes. Supervisors have no visibility into how students interact with their AI tools, making it impossible to assess workflow quality or diagnose problems.

**Who is affected?**
- **Students**: Lose session context between tool switches; cannot review what happened in previous sessions across different agents
- **Supervisors/Admins**: Have no insight into student-agent interaction patterns, session frequency, or error rates
- **MCP agents**: Need a structured way to record their activity during a session for observability and replay

**Current workarounds**: None. Agent sessions are ephemeral and local to each tool. Once a session ends, the interaction history is only available in the tool's own logs (if any), not in a centralized, queryable format.

## Goals & Objectives

### Primary Goals
1. **Full session lifecycle management**: Create, track, and end sessions with start/end timestamps and optional summaries
2. **Structured event logging**: Record 5 event types (`message`, `tool_call`, `file_edit`, `decision`, `error`) with content and optional metadata per event
3. **Agent type tracking**: Every session records which AI agent was used, enabling cross-agent analytics
4. **Project-scoped sessions**: Sessions are tied to a project, enabling project-level session history

### Secondary Goals
5. **MCP tool integration**: Three dedicated MCP tools (`session_start`, `session_log`, `session_end`) allow agents to manage sessions directly
6. **Retention-aware queries**: All event queries filter out archived events (`archivedAt IS NULL`) to respect data retention policies
7. **Paginated session listing**: Support limit/offset pagination with configurable page size (default 20)

### Non-Goals
- **Auto-close for abandoned sessions** — if an agent crashes or the user disconnects without calling `session_end`, the session remains open indefinitely with no `endedAt` timestamp. There is no timeout or cleanup mechanism for stale sessions.
- **Concurrent session limits** — a user can have unlimited open sessions for the same project and agent type simultaneously. There is no enforcement of one-session-at-a-time.
- **Real-time session streaming** — events are written and read via REST; there is no WebSocket or SSE stream for live session monitoring.
- **Session replay UI** — the dashboard shows session data but does not provide a step-by-step replay visualization.

## User Stories & Use Cases

### Student
- As a student, I want my AI agent to **automatically start a session** when I begin working so that my interactions are tracked.
- As a student, I want to **view my past sessions** for a project to recall what decisions were made and what tools were used.
- As a student, I want my agent to **log important events** (decisions, errors, file edits) so I have a record of significant actions.

### Supervisor/Admin
- As a supervisor, I want to **see all sessions across students** for a project to understand engagement and interaction patterns.
- As a supervisor, I want to **review session events** to understand the sequence of actions a student's agent took during a session.
- As a supervisor, I want to **see session summaries** to quickly assess what was accomplished without reading every event.

### MCP Agent
- As an AI agent, I want to **start a session on boot** using `session_start` with my agent type so all subsequent actions are attributed to this session.
- As an AI agent, I want to **log events during my session** using `session_log` with typed event categories and optional metadata (e.g., file paths for file_edit, tool names for tool_call).
- As an AI agent, I want to **end my session with a summary** using `session_end` so the session is properly closed and searchable.

## Success Criteria

| Criterion | Target |
|---|---|
| Session creation returns session ID | `POST /api/v1/sessions` returns 201 with session object including `id`, `agentType`, `startedAt` |
| Session end sets `endedAt` timestamp | `POST /api/v1/sessions/:id/end` updates `endedAt` and optional `summary` |
| All 5 event types accepted | `message`, `tool_call`, `file_edit`, `decision`, `error` validated by Zod enum |
| Events linked to session | Each event references `sessionId` (UUID FK) |
| Archived events excluded from reads | `getSession` and `listSessionEvents` both apply `isNull(sessionEvents.archivedAt)` filter |
| Session list supports pagination | `limit` (default 20) and `offset` (default 0) query params |
| Admin sees all sessions | When `request.userRole === "admin"`, the `userId` filter is omitted from `listSessions` |
| Students see only own sessions | Non-admin users are filtered by `userId` |
| MCP tools map to API endpoints | `session_start` -> POST sessions, `session_log` -> POST sessions/events, `session_end` -> POST sessions/:id/end |
| Zod validation on all inputs | `createSessionSchema`, `endSessionSchema`, `createSessionEventSchema` validate request bodies |

## Constraints & Assumptions

### Business Constraints
- **Academic observability**: Session tracking is primarily for supervisor oversight and student self-review. It does not need to meet production-grade APM standards.
- **Voluntary usage**: Session management is opt-in for agents. An agent that does not call `session_start` simply has no sessions recorded — this does not block any other functionality.

### Technical Constraints
- **No session state machine**: Sessions have two states (open and ended) determined by the presence of `endedAt`. There is no formal state machine, no "paused" or "failed" states, and no transition validation (e.g., you can end a session that is already ended — it just overwrites `endedAt`).
- **Events are append-only**: Once logged, events cannot be edited or deleted via the API. They can only be soft-deleted by the retention system (`archivedAt`).
- **Event metadata is unstructured**: The `metadata` field is `jsonb` with no schema validation beyond being a valid JSON object. Different event types may store different metadata shapes, but this is not enforced.
- **No session-level auth check**: The `getSession` and `listSessionEvents` endpoints do not verify that the requesting user owns the session. Any authenticated user can read any session by ID. Admin filtering only applies to `listSessions`.
- **Default pagination**: `listSessions` defaults to 20 results; this is hardcoded in the service, not configurable globally.

### Assumptions
- Each session belongs to exactly one project and one user. Cross-project sessions are not supported.
- Agent types are validated against the `AGENT_TYPES` constant (`claude-code`, `gemini-cli`, `cursor`, `kilo-code`, `opencode`, `generic`).
- Session events are ordered by `createdAt` ascending within a session.
- The MCP server resolves `projectId` from `MEMAI_PROJECT_ID` on startup; the agent does not need to specify it per-session.

## Questions & Open Items

- **Abandoned session cleanup**: Should there be a periodic job that auto-closes sessions older than N hours with no new events? Currently, sessions with no `endedAt` remain open forever, which could skew analytics (e.g., "average session duration" becomes meaningless).
- **Concurrent session limits**: Should there be a limit on how many open sessions a user can have per project? This could prevent accidental duplicate sessions from agent restarts.
- **Session ownership enforcement**: Should non-admin users only be able to read their own sessions and events? Currently, any authenticated user can fetch any session by ID.
- **Event metadata schema**: Should different event types have typed metadata schemas (e.g., `file_edit` events require a `filePath` field)? This would improve data quality but add validation complexity.
- **Session analytics**: Should the API expose aggregated session metrics (total sessions per agent type, average duration, event counts per type)? This data would be valuable for the admin dashboard.
- **Double-end protection**: Should ending an already-ended session return a 409 Conflict or be silently idempotent (current behavior)?
