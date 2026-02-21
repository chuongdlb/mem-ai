# Data Retention — Implementation Notes

## Files Modified

| File | Change |
|---|---|
| `packages/api/src/db/schema.ts` | Added `retentionPolicies` table, `archivedAt` to 3 tables, partial indexes |
| `packages/api/src/services/retention.service.ts` | **New** — retention service |
| `packages/api/src/index.ts` | Added scheduler (setInterval 24h + setTimeout 30s) |
| `packages/api/src/db/seed.ts` | Seed 3 default retention policies |
| `packages/api/src/routes/admin.ts` | 4 retention endpoints |
| `packages/api/src/services/session.service.ts` | `listSessionEvents` filters archived |
| `packages/api/src/services/memory.service.ts` | `getMemoryVersions` filters archived |
| `packages/api/src/services/audit.service.ts` | `getAuditLogs` filters archived |
| `packages/shared/src/validation.ts` | `updateRetentionPolicySchema` |
| `packages/dashboard/src/pages/SettingsPage.tsx` | Data Retention admin section |

## Patterns Used

- **Soft-delete via `archived_at`**: Rows are never hard-deleted; they get an `archived_at` timestamp. Normal queries exclude them with `isNull(archivedAt)`.
- **Batch processing**: `archiveExpiredRows` processes 1000 rows per batch to avoid long table locks.
- **No cron dependency**: Uses Node.js `setInterval` for scheduling — no system-level cron needed.
- **Drizzle raw SQL for batch update**: Uses `db.execute(sql\`...\`)` for the subquery-based batch UPDATE since Drizzle's query builder doesn't support UPDATE...WHERE id IN (SELECT...LIMIT).

## Key Decisions

- Global policies only (not per-user/project) to keep v1 simple
- Soft-delete over hard-delete for safety and auditability
- 30s startup delay before first cleanup to let DB connections settle
- Admin-only access for all retention endpoints
