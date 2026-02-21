# Data Retention — Planning

## Task Breakdown

1. **Schema changes** — Add `retention_policies` table, `archived_at` to 3 tables, partial indexes
2. **Retention service** — Create `retention.service.ts` with batch archive logic
3. **Scheduler** — `setInterval` in `index.ts` (24h interval, 30s startup delay)
4. **Seed defaults** — Add 3 default policies to `seed.ts`
5. **Admin API** — 4 endpoints in `admin.ts` (GET, PATCH, GET stats, POST run)
6. **Query filtering** — Add `isNull(archivedAt)` to session, memory, audit services
7. **Validation** — Add `updateRetentionPolicySchema` to shared validation
8. **Dashboard UI** — Data Retention section in Settings (admin only)
9. **Documentation** — Requirements, design, planning, implementation, testing docs

## Dependencies

- Steps 1-2 must complete before 3-6
- Step 7 (validation) needed by step 5 (API)
- All backend steps before step 8 (dashboard)

## Default Retention Periods

| Resource | Days | Rationale |
|---|---|---|
| session_events | 90 | Highest volume, least need for long history |
| memory_versions | 180 | Moderate volume, useful for rollback |
| audit_logs | 365 | Compliance, lowest urgency for cleanup |
