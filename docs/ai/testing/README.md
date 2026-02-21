---
phase: testing
title: Testing Strategy
description: Define testing approach, test cases, and quality assurance
---

# Testing Strategy

## Test Coverage Goals

| Layer | Target | Scope |
|---|---|---|
| Unit tests | 100% of utility functions and validation schemas | Shared schemas, PAT hashing, token encryption, export formatters |
| Integration tests | All critical API paths + error handling | Memory CRUD, session lifecycle, auth flow, webhook verification, repo sync |
| E2E tests | Key user journeys | Full MCP flow, OAuth → dashboard → create project → store memory |
| Performance tests | Latency benchmarks at scale | Vector search at 1K/10K/100K memories |

Alignment with requirements: Tests validate success criteria from `docs/ai/requirements/README.md` (round-trip latency, auto-import, semantic search accuracy, zero plaintext secrets).

## Unit Tests

### Zod Validation Schemas (`packages/shared`)
- [ ] `createMemorySchema` accepts valid input with all fields
- [ ] `createMemorySchema` rejects empty title, empty content
- [ ] `createMemorySchema` applies default category (`other`) and tags (`[]`)
- [ ] `createMemorySchema` rejects tags array > 20 items, tag > 50 chars
- [ ] `searchMemoriesSchema` enforces limit range (1-100, default 20)
- [ ] `createPatSchema` rejects empty name, non-positive expiresInDays
- [ ] `shareMemorySchema` requires at least one of `sharedWithUserId` or `sharedWithGroupId`
- [ ] `connectRepoSchema` validates required fields and UUID format
- [ ] `exportSchema` only accepts valid export formats
- [ ] `mcpMemoryWriteSchema` validates title length (1-500 chars)
- [ ] `updateMemorySchema` allows partial updates (all fields optional)
- [ ] All schemas reject unknown/extra fields

### PAT Hash/Verify (`packages/api/src/auth/pat.ts`)
- [ ] `generatePat()` returns token starting with `memai_` prefix
- [ ] `generatePat()` returns token of expected length (6 + 64 = 70 chars)
- [ ] `hashPat()` produces consistent SHA-256 hash for same input
- [ ] `hashPat()` produces different hashes for different tokens
- [ ] Hash output is 64 hex characters

### Token Encryption (`packages/api/src/services/github.service.ts`)
- [ ] `encryptToken()` returns `iv:authTag:ciphertext` format
- [ ] `decryptToken(encryptToken(plaintext))` round-trips correctly
- [ ] `encryptToken()` produces different ciphertext for same plaintext (random IV)
- [ ] `decryptToken()` throws on tampered ciphertext
- [ ] `decryptToken()` throws on wrong encryption key

### Webhook Signature Verification (`packages/api/src/services/github.service.ts`)
- [ ] `verifyWebhookSignatureSync()` accepts valid HMAC-SHA256 signature
- [ ] `verifyWebhookSignatureSync()` rejects invalid signature
- [ ] `verifyWebhookSignatureSync()` rejects empty signature
- [ ] Verification uses constant-time comparison (no timing side-channel)

### Export Formatters (`packages/api/src/routes/export.ts`)
- [ ] `claude-md` format produces valid Markdown with memory sections
- [ ] `gemini-md` format produces Gemini-compatible Markdown
- [ ] `cursorrules` format produces valid .cursorrules content
- [ ] `skill-md` format produces ai-devkit skill Markdown
- [ ] `json` format produces valid JSON array of memories
- [ ] `report` format produces human-readable summary report
- [ ] Export with no memories produces appropriate empty output

### Memory File Pattern Matching (`packages/shared/src/constants.ts`)
- [ ] `MEMORY_FILE_PATTERNS` correctly maps CLAUDE.md → `claude-code`
- [ ] Patterns match nested paths (`.claude/CLAUDE.md`)
- [ ] `.cursorrules` maps to `cursor`
- [ ] `MEMORY.md` and `memory.md` both map to `generic`

## Integration Tests

### Memory CRUD Cycle
- [ ] Create memory with valid data → returns 201 with memory ID
- [ ] Read created memory by ID → returns full memory with all fields
- [ ] Update memory title/content → returns updated memory, version incremented
- [ ] Update memory → previous version saved in `memoryVersions`
- [ ] Delete memory → returns 200, subsequent read returns 404
- [ ] List memories with projectId filter → returns only matching memories
- [ ] List memories with category filter → returns only matching category
- [ ] List memories with pagination (limit + offset) → correct subset returned
- [ ] Create memory with invalid projectId → returns 400 or 404

### Memory Search
- [ ] Text search returns memories matching query string
- [ ] Search with category filter narrows results
- [ ] Search with limit parameter caps result count
- [ ] Search with no matches returns empty array

### Memory Sharing
- [ ] Share memory with user → share record created
- [ ] Share memory with group → share record created
- [ ] Read shared memories → returns memories shared with current user
- [ ] Revoke share → share removed, memory no longer in shared list
- [ ] Share requires at least one target (user or group)

### Session Lifecycle
- [ ] Create session → returns session ID with agentType and startedAt
- [ ] Log event to session → event recorded with timestamp
- [ ] End session with summary → endedAt set, summary stored
- [ ] List session events → returns all events in order
- [ ] List sessions with projectId filter → correct subset

### Auth Flow
- [ ] JWT token validates correctly and returns user info
- [ ] Expired JWT is rejected with 401
- [ ] Valid PAT authenticates and returns user
- [ ] Invalid PAT returns 401
- [ ] Expired PAT returns 401
- [ ] PAT `lastUsedAt` updated on successful auth
- [ ] Missing Authorization header returns 401
- [ ] Admin-only endpoints reject student role with 403

### Webhook Signature Verification
- [ ] Valid GitHub push webhook with correct signature → 200, files processed
- [ ] Webhook with invalid signature → 401
- [ ] Webhook for unknown repo → 404 or ignored
- [ ] Webhook processes memory file changes (create/update)
- [ ] Webhook ignores non-memory files

### Repo Sync Flow
- [ ] Connect repo → creates record with webhookSecret
- [ ] List connected repos → returns repos with memory file counts
- [ ] Manual sync → scans repo for memory file patterns, creates/updates records
- [ ] Push memory to repo → creates/updates file via GitHub API
- [ ] Disconnect repo → removes record and webhook

### Version History
- [ ] Memory update creates version record with previous content
- [ ] Version records include changeReason and changedBy
- [ ] Get versions returns ordered history for a memory

## End-to-End Tests

### Full MCP Flow
- [ ] MCP `memory_write` → `memory_search` → `memory_read` → `memory_delete` round-trip
- [ ] MCP `session_start` → `session_log` (multiple events) → `session_end`
- [ ] MCP `shared_read` returns memories shared with the MCP user
- [ ] MCP `project_context` returns project stats and recent memories

### Dashboard User Journey
- [ ] OAuth login → redirected to callback → JWT stored → dashboard loads
- [ ] Navigate to Groups → create group → add student member
- [ ] Navigate to Projects → create project under group
- [ ] Navigate to Memories → view/filter/search memories
- [ ] Navigate to Sessions → view session list and details
- [ ] Navigate to Repos → connect GitHub repo → trigger sync
- [ ] Navigate to Settings → create PAT → copy token
- [ ] Admin: view system stats + audit logs

## Test Data

### Seed Script (`packages/api/src/db/seed.ts`)
The seed script creates baseline data for development and testing:
- **Admin user**: `admin@memai.dev` with `admin` role
- **Demo group**: "Demo Group" with admin as member
- **Demo project**: "Demo Project" linked to demo group

Uses `onConflictDoNothing()` for idempotent execution.

### CI Test Database
- PostgreSQL service container with pgvector extension (`pgvector/pgvector:pg16`)
- Database: `memai_test`, user: `memai`, password: `testpassword`
- Migrations run before tests: `pnpm db:generate && pnpm db:migrate`
- Environment: `JWT_SECRET=ci-test-secret`, `ENCRYPTION_KEY=0000...0000` (64 zero hex)

### Test Fixtures (To Be Created)
- Sample memories across all 7 categories
- Sample sessions with events for each of the 6 agent types
- Sample connected repo with memory file records
- Sample user with PAT for auth testing

## Test Reporting & Coverage

### Commands
```bash
pnpm test                          # Run all tests
pnpm test --coverage               # Run with coverage report
pnpm --filter @memai/shared test   # Run shared package tests only
pnpm --filter @memai/api test      # Run API tests only
```

### Coverage Thresholds
- **Shared package**: 100% of schemas and constants
- **API utilities** (auth, encryption, formatters): 100%
- **API routes**: 80%+ line coverage (focus on critical paths)
- **MCP server**: 90%+ (all tool handlers)

### Coverage Gaps
- OAuth token exchange (requires mock OAuth provider or real credentials)
- Ollama embedding generation (requires running Ollama instance)
- GitHub API file operations (requires valid GitHub token)

## Manual Testing

### Dashboard UI Checklist
- [ ] Login page renders with GitHub and Google OAuth buttons
- [ ] OAuth redirect and callback work correctly
- [ ] Dashboard home shows summary statistics
- [ ] Navigation between all pages works
- [ ] Memory list loads, filters work, search works
- [ ] Session list loads with correct agent type icons
- [ ] Repo connection flow works with real GitHub account
- [ ] Settings page allows PAT creation and copy
- [ ] Responsive layout on tablet/mobile viewports
- [ ] Admin-only pages (Students, Audit) hidden from students

### MCP Server Manual Test
```bash
# Set environment
export MEMAI_TOKEN=memai_<your-pat>
export MEMAI_PROJECT_ID=<project-uuid>
export MEMAI_API_URL=http://localhost:3000

# Run MCP server
npx memai-mcp

# Use with Claude Code (add to .claude/mcp.json)
```

## Performance Testing

### Vector Search Latency
| Dataset Size | Target p50 | Target p95 |
|---|---|---|
| 1,000 memories | < 50ms | < 100ms |
| 10,000 memories | < 100ms | < 300ms |
| 100,000 memories | < 500ms | < 1,000ms |

### API Latency Benchmarks
| Operation | Target |
|---|---|
| Memory create (without embedding) | < 100ms |
| Memory create (with embedding) | < 2,000ms |
| Memory list (20 items) | < 100ms |
| Memory search (text) | < 200ms |
| Session create | < 50ms |
| Health check | < 20ms |

### Load Testing
- Tool: `autocannon` or `k6`
- Scenario: 50 concurrent users, 100 req/min each, 5-minute duration
- Focus: Memory CRUD mix, search queries, session logging

## Bug Tracking

### Issue Tracking
- GitHub Issues on the mem-ai repository
- Labels: `bug`, `enhancement`, `testing`, `documentation`
- Severity levels: `critical` (data loss, auth bypass), `high` (feature broken), `medium` (degraded experience), `low` (cosmetic)

### Regression Testing
- All bug fixes must include a regression test
- CI runs full test suite on every PR
- Integration tests run against pgvector service container in CI
