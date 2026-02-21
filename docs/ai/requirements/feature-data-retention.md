---
phase: requirements
title: Data Retention — Requirements
description: Requirements for automated data lifecycle management on high-volume tables
---

# Data Retention — Requirements

## Problem Statement

Three high-volume tables (`session_events`, `memory_versions`, `audit_logs`) grow unbounded. On a single Digital Ocean VPS with limited disk, this leads to slower queries and eventual disk pressure.

| Table | Growth Driver | Est. rows/year (50 students) | Est. size/year |
|---|---|---|---|
| `session_events` | ~200 events/session, ~5 sessions/week/student | ~2.6M rows | ~1.5 GB |
| `memory_versions` | 1 row per memory mutation | ~130K rows | ~150 MB |
| `audit_logs` | 1 row per API action | ~500K rows | ~600 MB |

**Who is affected?**
- **Admins**: Responsible for disk management and monitoring DB growth on a resource-constrained VPS
- **All users**: Experience query performance degradation as tables grow (unindexed scans over millions of rows)

**Current workarounds**: None. Tables grow without limit. Admins would need to manually run SQL to delete old rows, with no visibility into what's safe to remove.

## Goals & Objectives

### Primary Goals
1. **Configurable retention periods** per resource type (global, not per-user) so admins can tune data lifecycle
2. **Automated daily cleanup** via soft-delete (`archived_at` timestamp) to keep active datasets small and queries fast
3. **Admin visibility** into retention policies and archive statistics via API and dashboard

### Secondary Goals
4. Admin can **trigger manual cleanup** via dashboard without waiting for the daily schedule
5. **Default policies seeded** on first deploy so the system works out of the box

### Non-Goals
- **Per-user or per-project retention policies** — v1 is global only
- **Hard-delete** — data is archived (soft-deleted), not destroyed. Archived rows still consume disk. Admins can purge manually via SQL if disk reclamation is needed. A future phase may add a hard-delete/VACUUM workflow.
- **Archived data browsing** — no UI or API for querying archived rows is planned for v1. Archived rows remain in the database and are accessible via direct SQL (`WHERE archived_at IS NOT NULL`) for ad-hoc investigation.
- **Real-time streaming cleanup** — batch processing on a daily schedule is sufficient

## User Stories & Use Cases

### Admin
- As an admin, I want to **configure retention periods** (in days) for session events, memory versions, and audit logs so that I can control how long high-volume data stays active.
- As an admin, I want to **enable or disable retention** per resource type so that I can pause cleanup if needed (e.g., during an investigation).
- As an admin, I want to **see active vs archived row counts** per table so that I can monitor the effectiveness of retention policies.
- As an admin, I want to **trigger a manual cleanup run** so that I can free up query performance immediately without waiting for the daily schedule.
- As an admin, I want **default retention policies** seeded on deploy so that the system manages data lifecycle out of the box.

### Student (implicit)
- As a student, I expect my **recent session events and memory versions to remain accessible** — archiving should be invisible to normal usage. Only data older than the retention period is affected.

### System
- As the API server, I run a **scheduled cleanup job every 24 hours** that archives expired rows in batches, logging results for observability.

## Success Criteria

| Criterion | Target |
|---|---|
| Archived rows excluded from all read queries | `isNull(archivedAt)` applied to all queries on the 3 affected tables, including relation-based queries |
| Daily scheduled job execution time | < 30s for typical workloads |
| Admin can view/change policies | Dashboard Settings page shows retention config for admin users |
| Default policies seeded | session_events=90d, memory_versions=180d, audit_logs=365d |
| Batch processing avoids long locks | Archive in batches of 1000 rows per iteration |
| No new dependencies | Scheduler uses Node.js `setInterval`, no cron or job queue needed |

## Constraints & Assumptions

### Business Constraints
- **No additional infrastructure cost**: No external job queue, cron service, or message broker. The scheduler runs in-process using `setInterval`.
- **Academic context**: Retention periods don't require compliance-grade audit trails. Soft-delete with admin SQL access is sufficient for data governance.

### Technical Constraints
- **Single API process**: The `setInterval` scheduler runs inside the API process. If multiple API replicas were deployed, cleanup would run in each replica concurrently. This is acceptable for the current single-VPS deployment but would need coordination (e.g., advisory locks) for horizontal scaling.
- **No cron dependency**: Scheduler uses `setInterval` + `setTimeout` — no system-level cron or external job runner needed.
- **Soft-delete does not reclaim disk**: Setting `archived_at` hides rows from queries but does not free storage. The primary benefit is **query performance** (smaller active datasets, partial indexes). Disk reclamation requires a separate hard-delete + `VACUUM` step, which is out of scope for v1.
- **Drizzle migration required**: Adding columns and tables requires `pnpm db:generate` + `pnpm db:migrate`. Existing rows get `archived_at = NULL` (treated as active), which is correct behavior.
- **Batch size hardcoded**: Archive batches are fixed at 1000 rows. This is not admin-configurable in v1.

### Assumptions
- The 30s startup delay before the first cleanup run is sufficient for DB connections to establish.
- Admin users are the only ones who need retention visibility — students don't need to know about archival.
- The three targeted tables are the only high-volume tables; other tables (users, groups, projects, memories, sessions) grow slowly and don't need retention.

## Questions & Open Items

- **Disk reclamation path**: Soft-delete alone doesn't free disk. Should a future phase add a "purge archived rows" admin action with hard-delete + `VACUUM FULL`? If so, what safety guardrails (confirmation, minimum age for purge)?
- **Batch size tuning**: Is 1000 rows per batch optimal? For very large backlogs (millions of expired rows), the initial cleanup could take many iterations. Should the batch size be configurable or auto-tuned?
- **Stats query performance**: `getRetentionStats()` runs 6 `COUNT(*)` queries (2 per table). At scale with millions of rows, these could be slow. Consider caching or using `pg_stat_user_tables` for approximate counts.
- **Horizontal scaling**: If the API is ever scaled to multiple replicas, the `setInterval` scheduler would run in each process. Should advisory locks or a leader-election pattern be added preemptively?
