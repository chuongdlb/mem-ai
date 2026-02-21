---
phase: requirements
title: GitHub Integration — Requirements
description: Requirements for connecting GitHub repositories to MemAI projects with bidirectional memory file sync
---

# GitHub Integration — Requirements

## Problem Statement

Thesis students working with AI coding agents accumulate memory files (CLAUDE.md, GEMINI.md, .cursorrules, etc.) inside their GitHub repositories. These files contain valuable context — conventions, architecture decisions, agent preferences — but remain siloed in each repo with no centralized view. Supervisors and students have no way to see how these memory files evolve across pushes, and there is no mechanism to export memories back to repos after editing them in the dashboard.

**Who is affected?**
- **Students**: Need their repo-based memory files imported into MemAI automatically so all agents share unified context, and need to push edited memories back to repos
- **Admins/Supervisors**: Want visibility into which repos students have connected and what memory files exist across projects
- **System**: Must securely store GitHub tokens, manage webhooks, and keep imported memory files in sync with their repo counterparts

**Current workarounds**: Students would have to manually copy-paste memory file contents between repos and the MemAI dashboard. No automation, no deduplication, no audit trail of changes.

## Goals & Objectives

### Primary Goals
1. **Connect GitHub repos to MemAI projects** with automated webhook registration for push events
2. **Auto-import memory files** from connected repos by scanning for known file patterns (CLAUDE.md, GEMINI.md, .cursorrules, MEMORY.md, etc.)
3. **Webhook-driven sync** so that pushes to connected repos automatically update the corresponding memories in MemAI
4. **Push memories back to repos** via the GitHub Contents API so that dashboard edits can be exported to the repository
5. **Secure token storage** using AES-256-GCM encryption for GitHub access tokens at rest

### Secondary Goals
6. **Manual re-sync** endpoint so users can trigger a full scan outside of webhook events
7. **Disconnect repos** cleanly, removing the GitHub webhook and local tracking records
8. **SHA-based deduplication** to skip re-importing files that haven't changed since the last sync

### Non-Goals
- **Wildcard/glob pattern scanning**: The `.kilocode/rules/**/*.md` pattern is defined in `MEMORY_FILE_PATTERNS` but is filtered out at runtime. Only static (non-glob) paths are scanned. Wildcard support is deferred.
- **Handling removed files**: Webhook push payloads include `removed` arrays, but the current implementation only processes `added` and `modified` files. Deleted memory files in the repo are not reflected in MemAI.
- **Branch-aware scanning**: All scanning uses the default branch. Scanning across feature branches or pull requests is not in scope.
- **Bi-directional conflict resolution**: If a memory is edited in both MemAI and the repo, the last write wins. No merge or conflict detection is provided.
- **Repo-level access control**: Any authenticated user with a valid GitHub token can connect any repo they have access to. There is no admin approval workflow for repo connections.

## User Stories & Use Cases

### Student
- As a student, I want to **browse my GitHub repos** from the MemAI dashboard so I can choose which ones to connect.
- As a student, I want to **connect a repo to a project** so that its memory files (CLAUDE.md, .cursorrules, etc.) are automatically imported as memories.
- As a student, I want **pushes to my repo** to automatically update the corresponding memories in MemAI so I don't have to re-import manually.
- As a student, I want to **push a memory back to a repo** so that edits I make in the dashboard are reflected in the repo file.
- As a student, I want to **disconnect a repo** when I no longer need the integration, and have the webhook cleaned up automatically.
- As a student, I want to **manually trigger a re-sync** if I suspect the webhook missed something or if I connected the repo before adding memory files.

### System
- As the API, I **register a GitHub webhook** on the repo when it is connected, listening for `push` events sent to `/api/v1/webhooks/github`.
- As the webhook handler, I **verify HMAC-SHA256 signatures** using timing-safe comparison to ensure payloads are authentic.
- As the sync service, I **skip files whose SHA matches** the last recorded `fileSha` in `repo_memory_files` to avoid redundant updates.
- As the sync service, I **create new memories** for newly discovered files and **update existing memories** (with version tracking) for changed files.

## Success Criteria

| Criterion | Target |
|---|---|
| Repo listing returns user's GitHub repos | Fetches up to 100 repos sorted by last updated via GitHub API |
| Webhook registered on connect | `POST /repos/{owner}/{repo}/hooks` called with push event and JSON content type |
| Webhook signature verified | HMAC-SHA256 with timing-safe comparison; invalid signatures return 401 |
| Memory files discovered on connect | All static `MEMORY_FILE_PATTERNS` checked via GitHub Contents API |
| SHA deduplication works | Files with unchanged `fileSha` are skipped during scan |
| Push-to-repo writes file via GitHub API | `PUT /repos/{owner}/{repo}/contents/{path}` with base64 content and existing SHA for updates |
| Webhook cleanup on disconnect | `DELETE /repos/{owner}/{repo}/hooks/{id}` called; errors logged but not blocking |
| GitHub tokens encrypted at rest | AES-256-GCM with random 12-byte IV and auth tag, stored as `iv:authTag:data` hex string |
| Webhook failure is non-blocking | Webhook creation failures during connect are logged as warnings; repo is still saved |

## Constraints & Assumptions

### Business Constraints
- **GitHub OAuth required**: Only users who authenticated via GitHub OAuth have an encrypted access token. Google OAuth users cannot use any repo features (no GitHub token is stored for them).
- **GitHub API rate limits**: The user's OAuth token is used for all GitHub API calls. GitHub imposes a 5,000 requests/hour limit per token. Scanning many repos with many files could approach this limit.

### Technical Constraints
- **Static patterns only**: The `MEMORY_FILE_PATTERNS` array includes a glob pattern (`.kilocode/rules/**/*.md`), but the sync service filters it out with `!p.path.includes("*")`. Only exact file paths are checked via the GitHub Contents API, which does not support glob queries.
- **No removed-file handling**: The webhook handler collects `added` and `modified` files from push commits but ignores the `removed` array. If a memory file is deleted from the repo, the corresponding memory and `repo_memory_files` record persist in MemAI.
- **Webhook processing is fire-and-forget**: `handleWebhookPush` runs asynchronously after the webhook endpoint returns `{ message: "Processing" }`. Errors are logged but not reported to GitHub.
- **Single repo-to-project link**: A connected repo has one optional `projectId`. Memory files are only imported if a project is linked. Repos connected without a project skip the initial scan.
- **Encryption key dependency**: The `ENCRYPTION_KEY` environment variable must be a 64-character hex string (32 bytes). It defaults to all zeros in development, which is insecure. Rotation of the encryption key would require re-encrypting all stored tokens.
- **Webhook secret per repo**: Each connected repo gets a unique 32-byte random webhook secret stored in the `connected_repos` table. This secret is used for signature verification.

### Assumptions
- Users have admin or write access to repos they connect (required for webhook registration). If webhook creation fails (e.g., insufficient permissions), the repo is still connected but won't receive push events.
- The API server is publicly accessible at `API_URL` for GitHub to deliver webhook payloads.
- Memory files are text-based and reasonably sized. The GitHub Contents API has a 1 MB file size limit.
- A single connected repo per user-per-GitHub-repo is enforced by a unique constraint on `(userId, githubRepoId)`.

## Questions & Open Items

- **Wildcard pattern support**: The `.kilocode/rules/**/*.md` pattern is currently excluded. Should the scan use the GitHub Trees API to enumerate files and match globs? This would add one additional API call per scan but enable full pattern coverage.
- **Removed file handling**: When a memory file is deleted from a repo push, should the corresponding memory be deleted, archived, or flagged? The current implementation silently ignores deletions.
- **Token refresh**: GitHub OAuth tokens don't expire by default, but users can revoke them. Should the API detect revoked tokens (401 from GitHub) and prompt re-authentication?
- **Multi-branch support**: Should users be able to configure which branch to scan, or always use the default branch?
- **Concurrent webhook processing**: If multiple rapid pushes arrive for the same repo, `scanRepoForMemoryFiles` could run concurrently. Should an advisory lock or queue be added to prevent race conditions on `repo_memory_files` upserts?
- **Google OAuth users**: Users who sign in with Google see a "No GitHub token" error when attempting repo operations. Should the UI hide repo features entirely for Google-only users, or prompt them to link a GitHub account?
