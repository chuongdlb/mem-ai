---
phase: requirements
title: Memory Export — Requirements
description: Requirements for exporting shared memories into agent-specific file formats
---

# Memory Export — Requirements

## Problem Statement

Students use multiple AI coding agents (Claude Code, Gemini CLI, Cursor, Kilo Code, OpenCode), each expecting project context in a different file format (CLAUDE.md, GEMINI.md, .cursorrules, etc.). Without a centralized export system, students must manually copy and reformat their shared memories into each agent's expected format every time they switch tools.

**Who is affected?**
- **Students**: Need to export accumulated project memories into agent-specific formats so each AI tool has the right context
- **Supervisors/Admins**: Need human-readable reports to review student progress and memory quality

**Current workarounds**: Without the export feature, students would need to manually compose each agent's context file by hand, duplicating content across formats and risking inconsistency.

## Goals & Objectives

### Primary Goals
1. **Single-endpoint export** that accepts a project ID and target format, returning the full set of project memories formatted for the target agent or use case
2. **6 supported formats** covering the major AI coding agents and general-purpose needs: `claude-md`, `gemini-md`, `cursorrules`, `skill-md`, `json`, `report`
3. **Format-specific templates** that follow each agent's expected file conventions (headings, structure, content layout)

### Secondary Goals
4. **Correct Content-Type headers** so clients can save the response directly as a file without manual renaming
5. **Category-based grouping** in applicable formats (claude-md, report) to organize memories logically

### Non-Goals
- **File download with Content-Disposition** — the API returns raw content; the client (dashboard or MCP) is responsible for saving it to disk
- **Selective export** — v1 exports all memories for a project. Filtering by category, tag, or date range is not supported
- **Embedding/vector export** — embedding vectors are excluded from all export formats
- **Template customization** — format templates are hardcoded in the service; admins cannot define custom formats

## User Stories & Use Cases

### Student
- As a student, I want to **export my project's memories as a CLAUDE.md file** so I can drop it into my repository and give Claude Code full context.
- As a student, I want to **export as GEMINI.md** so Gemini CLI has a flat list of my project knowledge.
- As a student, I want to **export as .cursorrules** so Cursor picks up my conventions and decisions automatically.
- As a student, I want to **export as JSON** so I can programmatically process my memories or import them elsewhere.

### Supervisor/Admin
- As a supervisor, I want to **generate a memory report** for a student's project that shows memory counts per category and full content, so I can assess the quality and completeness of their context documentation.

### MCP Agent
- As an AI agent, I want to trigger an export via the API so that memories can be pushed to a GitHub repo in the correct format for my agent type.

## Success Criteria

| Criterion | Target |
|---|---|
| Endpoint accepts all 6 format values | `claude-md`, `gemini-md`, `cursorrules`, `skill-md`, `json`, `report` validated via Zod enum |
| Content-Type matches format | `text/markdown` for claude-md, gemini-md, skill-md, report; `text/plain` for cursorrules; `application/json` for json |
| claude-md output uses `# Project` / `## Category` / `### Title` heading hierarchy | Matches CLAUDE.md conventions |
| gemini-md output uses flat `- **Title**: Content` list | Matches GEMINI.md conventions |
| cursorrules output uses `# Title` + content blocks without project header | Matches .cursorrules conventions |
| report includes generation timestamp and per-category counts | Human-readable summary format |
| json output is valid JSON with pretty-printing (2-space indent) | Parseable by any JSON consumer |
| Memories ordered by category then createdAt | Consistent ordering across exports |
| Authentication required | `authMiddleware` applied; unauthenticated requests rejected |

## Constraints & Assumptions

### Business Constraints
- **Agent format conventions are best-effort**: There is no formal specification for CLAUDE.md or GEMINI.md formats. Templates are based on observed conventions and may need updating as agents evolve.
- **Academic use case**: Exports are for individual project use and supervisor review, not for enterprise compliance or auditing.

### Technical Constraints
- **Single endpoint, synchronous**: `POST /api/v1/export` fetches all project memories and formats in a single request/response cycle. For projects with thousands of memories, this could be slow, but the expected scale (50 students, <500 memories per project) makes this acceptable.
- **No streaming**: The full formatted output is built in memory before sending. No chunked/streaming response.
- **Validation via `@memai/shared`**: The `exportSchema` Zod schema validates `projectId` (UUID) and `format` (enum). Invalid formats are rejected before reaching the service.
- **Project existence check**: The service throws a plain `Error("Project not found")` if the project ID does not exist. This is not wrapped in an HTTP-friendly error by the route handler (Fastify catches it as a 500).

### Known Issues
- **`skill-md` format is unimplemented**: The `skill-md` case is not handled in the format switch statement and falls through to the `default` case, which returns raw JSON. Despite the Content-Type header being set to `text/markdown`, the response body is JSON. This is a known bug that needs to be fixed with a proper skill-md template.

### Assumptions
- All memories for a project should be included in every export — no partial exports or filtering.
- The `groupByCategory` helper preserves insertion order of categories as encountered, not alphabetical or predefined order.
- Export is a read-only operation; it does not modify memories or create audit log entries.

## Questions & Open Items

- **skill-md template**: What should the skill-md format look like? It should follow the conventions for `.skill.md` files used by AI coding tools. This needs to be designed and implemented to replace the current fallthrough-to-JSON behavior.
- **Error handling for missing projects**: Should the route return a structured 404 instead of letting the thrown error become a 500? Currently the service throws `Error("Project not found")` which Fastify does not handle gracefully.
- **Selective export**: Should a future version support filtering by category, tag, date range, or pinned status? This would reduce export size and let students create focused context files.
- **Export size limits**: For very large projects, should there be a memory count limit or pagination in the export? Current implementation loads all memories into a single array.
- **Filename suggestions**: Should the API return a `Content-Disposition` header with a suggested filename (e.g., `CLAUDE.md`, `.cursorrules`) to make browser-based downloads seamless?
