# Data Retention — Testing

## Test Cases

### Schema
- [ ] `pnpm db:generate` produces migration with `retention_policies` table and 3 `archived_at` columns
- [ ] Partial indexes created on `archived_at IS NULL`

### Seed
- [ ] Running seed creates 3 default policies (session_events=90d, memory_versions=180d, audit_logs=365d)
- [ ] Re-running seed does not duplicate policies (onConflictDoNothing)

### API Endpoints
- [ ] `GET /api/v1/admin/retention` returns 3 policies with correct defaults
- [ ] `PATCH /api/v1/admin/retention/session_events` with `{ days: 30 }` updates the policy
- [ ] `PATCH /api/v1/admin/retention/session_events` with `{ enabled: false }` disables the policy
- [ ] `PATCH /api/v1/admin/retention/nonexistent` returns 404
- [ ] `GET /api/v1/admin/retention/stats` returns active/archived counts per resource
- [ ] `POST /api/v1/admin/retention/run` triggers cleanup and returns results
- [ ] All endpoints return 403 for non-admin users

### Archival Logic
- [ ] Insert test rows with `created_at` older than retention period
- [ ] Call `POST /api/v1/admin/retention/run`
- [ ] Verify old rows get `archived_at` set
- [ ] Verify rows newer than retention period are untouched

### Query Filtering
- [ ] After archiving session events, `GET /sessions/:id/events` excludes archived
- [ ] After archiving memory versions, `GET /memories/:id/versions` excludes archived
- [ ] After archiving audit logs, `GET /admin/audit` excludes archived

### Scheduler
- [ ] Server logs show "Retention cleanup" within 30s of startup
- [ ] Scheduler runs again after 24h interval (manual verification or mock timer)

### Dashboard
- [ ] Admin sees "Data Retention" section in Settings
- [ ] Non-admin does not see the section
- [ ] Can edit days input and see it persist after blur
- [ ] Toggle enable/disable updates immediately
- [ ] "Run Now" button triggers cleanup and refreshes stats
- [ ] Stats show correct active/archived counts

### Performance
- [ ] `POST /api/v1/admin/retention/run` completes in < 30s with 10K expired rows per table (seed test data, time the request)

### Build
- [ ] `pnpm build` succeeds for all packages
