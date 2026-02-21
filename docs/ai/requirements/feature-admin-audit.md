---
phase: requirements
title: Admin & Audit System — Requirements
description: Requirements for admin dashboard statistics and action audit trail for supervisor oversight
---

# Admin & Audit System — Requirements

## Problem Statement

Supervisors overseeing thesis cohorts need visibility into system-wide activity: how many students are active, how many memories and sessions exist, and what actions users are performing. Without centralized admin tooling, supervisors must query the database directly or rely on individual student self-reports. Additionally, for academic integrity and system troubleshooting, an audit trail of user actions is essential.

**Who is affected?**
- **Supervisors/Admins**: Cannot see system-wide metrics, user activity patterns, or investigate incidents without direct DB access
- **Students** (indirectly): Benefit from supervisors being able to monitor system health, enforce retention policies, and troubleshoot issues
- **System operators**: Need audit data for debugging, security review, and compliance with institutional policies

**Current workarounds**: Admins would need to run SQL queries directly against the database to get counts, review user activity, or investigate incidents. There is no structured API or dashboard for admin operations.

## Goals & Objectives

### Primary Goals
1. **System statistics dashboard**: Expose aggregate counts (users, groups, projects, memories, sessions) via a single API endpoint for admin overview
2. **Audit log retrieval**: Query-able audit trail of user actions with filtering by userId, resourceType, and pagination
3. **Role-based access control (RBAC)**: `requireAdmin` middleware that restricts admin endpoints to users with the `admin` role
4. **Retention policy management**: Admin endpoints to view, update, trigger, and monitor data retention policies

### Secondary Goals
5. **Audit log middleware** (defined but not active): A reusable Fastify `preHandler` function (`auditLog`) that can be attached to routes to automatically log actions after response
6. **Retention statistics**: Endpoint showing active vs. archived row counts per retention-managed table

### Non-Goals
- **Automatic audit logging on all routes** — the `auditLog` middleware function is **defined but not registered on any route**. Audit entries are only created when `logAudit()` is called manually from service code. Comprehensive automatic auditing is not implemented.
- **Formal list of auditable actions** — there is no enum or constant defining which actions are auditable. The `action` and `resourceType` fields are free-form strings, meaning audit entries lack standardization.
- **Admin user management UI** — admins can view users and change roles via the users endpoints, but there is no dedicated admin panel for user management (e.g., bulk operations, user creation, password reset).
- **Real-time alerts** — no alerting mechanism for suspicious activity, error spikes, or threshold breaches.
- **Granular permissions** — RBAC is binary: `student` or `admin`. There are no intermediate roles (e.g., supervisor, group-admin) or per-resource permissions.

## User Stories & Use Cases

### Admin — System Overview
- As an admin, I want to **see total user, group, project, memory, and session counts** on a single dashboard so I can monitor overall system usage.
- As an admin, I want **statistics to update in real-time** (on refresh) so I always see current numbers.

### Admin — Audit Trail
- As an admin, I want to **browse the audit log** to see recent user actions across the system.
- As an admin, I want to **filter audit logs by user** to investigate a specific student's activity.
- As an admin, I want to **filter audit logs by resource type** (e.g., "memory", "session") to focus on specific subsystems.
- As an admin, I want **paginated audit results** so I can browse through large volumes of audit data.

### Admin — Retention Management
- As an admin, I want to **view all retention policies** to see current retention periods and enabled/disabled status for each resource type.
- As an admin, I want to **update retention periods** (days) and toggle enabled/disabled per resource type.
- As an admin, I want to **trigger a manual retention cleanup** when I need immediate results instead of waiting for the daily schedule.
- As an admin, I want to **see retention statistics** (active vs. archived row counts) to monitor the effectiveness of retention policies.

### System
- As the API, I want to **reject non-admin requests** to admin endpoints with a 403 Forbidden response so that students cannot access admin functionality.
- As the audit middleware (when registered), I want to **log actions asynchronously** after the response is sent so that audit logging does not add latency to the user's request.

## Success Criteria

| Criterion | Target |
|---|---|
| Stats endpoint returns 5 counts | `GET /api/v1/admin/stats` returns `{ users, groups, projects, memories, sessions }` as numbers |
| Audit log supports filtering | `GET /api/v1/admin/audit` accepts `userId`, `resourceType`, `limit`, `offset` query params |
| Audit log excludes archived rows | Query applies `isNull(auditLogs.archivedAt)` filter |
| Audit log default pagination | Default limit=50, offset=0 |
| RBAC rejects non-admin users | `requireAdmin()` middleware returns 403 for users with `role !== "admin"` |
| RBAC chains with auth middleware | All admin routes use `preHandler: [authMiddleware, requireAdmin()]` |
| Retention CRUD works | GET policies, PATCH policy by resource, GET stats, POST run all return correct data |
| Audit middleware logs asynchronously | `reply.then()` pattern ensures audit insert happens after response is sent |
| Stats queries are simple COUNT(*) | No complex joins or aggregations; one count per table |

## Constraints & Assumptions

### Business Constraints
- **Single-admin model sufficient for v1**: The system assumes a small number of admins (1-3 supervisors). There is no need for admin teams, delegation, or admin audit of other admins.
- **Academic context**: Audit requirements are for educational oversight, not regulatory compliance. The audit trail does not need tamper-proofing, digital signatures, or immutability guarantees.

### Technical Constraints
- **Audit middleware is not registered**: The `auditLog(action, resourceType)` function in `packages/api/src/middleware/audit.ts` returns a Fastify `preHandler` that logs after response via `reply.then()`. However, **no route in the application uses this middleware**. For audit entries to exist, `logAudit()` from `packages/api/src/services/audit.service.ts` must be called explicitly in service code. This means the audit trail is incomplete and only captures actions where developers remembered to add manual logging.
- **Free-form action strings**: The `action` and `resourceType` fields in `auditLogs` are plain `text` columns with no validation. There is no enum constraining values like `"create"`, `"update"`, `"delete"`. This makes audit data inconsistent and hard to query reliably.
- **Stats use sequential COUNT(*)**: The stats endpoint runs 5 separate `COUNT(*)` queries (one per table). These are not wrapped in a transaction, so counts may be slightly inconsistent if data changes between queries. For the expected scale (50 students), this is acceptable.
- **RBAC is role-string comparison**: `requireAdmin()` calls `requireRole("admin")` which checks `request.userRole` (set by `authMiddleware`). The role is a plain string from the JWT/PAT, not an enum in the middleware. If the role value in the DB does not match `"admin"` exactly, access is denied.
- **No admin activity logging**: Admin actions (viewing stats, reading audit logs, changing retention policies) are not themselves audited. An admin can perform actions without any record.
- **Retention endpoints reuse existing service**: The retention CRUD in admin routes delegates to `retention.service.ts`, which is also used by the automated scheduler. No additional logic layer exists in the admin route handlers.

### Assumptions
- The `request.userId` and `request.userRole` properties are reliably set by `authMiddleware` before RBAC checks run.
- Audit log volume is manageable with the retention system archiving old entries (default 365 days).
- The 5 stats counts are sufficient for the admin overview; more detailed analytics (e.g., time-series, per-group breakdowns) are out of scope for v1.
- The `ipAddress` field in audit logs captures `request.ip`, which may be the load balancer's IP in a reverse-proxy setup unless `X-Forwarded-For` is configured.

## Questions & Open Items

- **Registering the audit middleware**: The `auditLog` middleware function exists but is not used on any route. Should it be registered on write operations (POST, PATCH, DELETE) across the API? If so, which routes? This would provide automatic, comprehensive audit coverage rather than relying on manual `logAudit()` calls.
- **Standardizing auditable actions**: Should an enum or constant list define the valid `action` and `resourceType` values (e.g., `memory.create`, `session.end`, `repo.connect`)? This would improve consistency and enable reliable filtering/aggregation.
- **Admin self-auditing**: Should admin actions (viewing audit logs, changing retention policies, running cleanup) be recorded in the audit log? This creates a "who watches the watchers" trail.
- **Stats caching**: For larger deployments, should stats be cached (e.g., 60-second TTL) to avoid running 5 COUNT(*) queries on every dashboard refresh?
- **Granular roles**: Is the binary student/admin role model sufficient long-term? Potential future needs include a "supervisor" role (can view students' data but not change system config) or a "group-admin" role (can manage their own group only).
- **IP address accuracy**: In the current deployment behind a reverse proxy, does `request.ip` return the client's real IP or the proxy's IP? Should `trustProxy` be configured in Fastify?
