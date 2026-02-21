---
phase: requirements
title: Memory Sharing — Requirements
description: Requirements for sharing memories between users and groups with configurable access levels
---

# Memory Sharing — Requirements

## Problem Statement

Students in thesis cohorts often work on related problems and accumulate overlapping knowledge in their AI memory stores. Without a sharing mechanism, a student who discovers a useful architectural pattern, convention, or snippet cannot share it with teammates or other cohort members. Supervisors also need a way to distribute guidance or reference material to entire groups.

**Who is affected?**
- **Students**: Cannot share useful memories with teammates; must duplicate knowledge by manually copying content
- **Supervisors/Admins**: Cannot push shared conventions or guidance to student groups through the memory system
- **MCP agents**: Need a way to read memories shared with the current user to incorporate external context into their work

**Current workarounds**: Students would need to verbally communicate knowledge or manually create duplicate memories in each other's projects. There is no programmatic way to reference another user's memories.

## Goals & Objectives

### Primary Goals
1. **Share a memory with a specific user or group** — a single share targets either one user or one group, not both simultaneously (mutually exclusive, validated by Zod refinement)
2. **Two share levels** — `read` (default) and `write`, controlling the recipient's access level
3. **Unshare** — revoke a specific share by its share ID, performing a hard delete of the share record

### Secondary Goals
4. **View shares on a memory** — the memory owner can see all active shares (user and group) for a given memory
5. **View memories shared with me** — a user can retrieve all memories shared with them directly or via their group memberships
6. **MCP access via `shared_read`** — AI agents can call the `shared_read` tool to read all memories shared with the authenticated user

### Non-Goals
- **Write-level share enforcement** — the `write` level is stored in the database but **has no enforcement logic**. Recipients with `write` level cannot actually edit the shared memory through any API endpoint. The level field exists for future use but is currently non-functional.
- **Cascading to new group members** — when a memory is shared with a group, only current group members can access it via the `getSharedMemories` query. However, the query is evaluated at read time based on current group membership, so **new members added after the share was created will see the shared memory**. Conversely, members removed from the group lose access. This is implicit rather than explicitly designed.
- **Share notifications** — no email, webhook, or in-app notification is sent when a memory is shared with a user or group.
- **Transitive sharing** — a recipient cannot re-share a memory that was shared with them. Only the original memory exists; sharing creates a reference, not a copy.
- **Share expiration** — shares are permanent until explicitly unshared. There is no TTL or auto-expiration mechanism.

## User Stories & Use Cases

### Student (Sharer)
- As a student, I want to **share a memory with a specific teammate** so they can reference my architectural decisions or conventions in their own work.
- As a student, I want to **share a memory with my entire thesis group** so everyone in the cohort has access to common knowledge.
- As a student, I want to **see who has access to my memory** so I can audit and manage shares.
- As a student, I want to **revoke a share** when it is no longer relevant or was shared by mistake.

### Student (Recipient)
- As a student, I want to **see all memories shared with me** (both directly and via my groups) so I can benefit from shared knowledge.
- As a student, I expect shared memories to **appear alongside my own context** when I use the MCP `shared_read` tool.

### Supervisor/Admin
- As a supervisor, I want to **share reference memories with a student group** so I can distribute project conventions or guidance to the entire cohort.

### MCP Agent
- As an AI agent, I want to call `shared_read` to **retrieve all memories shared with my user** so I can incorporate team knowledge into my responses.

## Success Criteria

| Criterion | Target |
|---|---|
| Share with user | `POST /api/v1/memories/share` with `sharedWithUserId` creates a share record |
| Share with group | `POST /api/v1/memories/share` with `sharedWithGroupId` creates a share record |
| Mutual exclusivity enforced | Zod `.refine()` rejects requests with both `sharedWithUserId` and `sharedWithGroupId` set |
| At least one target required | Zod `.refine()` rejects requests with neither `sharedWithUserId` nor `sharedWithGroupId` |
| Default share level is `read` | Omitting `level` defaults to `"read"` |
| Unshare deletes the record | `DELETE /api/v1/memories/shares/:shareId` hard-deletes the memoryShares row |
| View shares returns all shares for a memory | `GET /api/v1/memories/:id/shares` returns all memoryShares rows for that memoryId |
| View shared memories resolves user + group shares | `GET /api/v1/memories/shared` returns memories shared with the user directly OR via groups the user belongs to |
| MCP `shared_read` returns shared memories | Tool returns JSON array of shared memories or "No shared memories available." |
| Authentication required on all endpoints | `authMiddleware` applied to share, unshare, getShares, getShared |

## Constraints & Assumptions

### Business Constraints
- **Academic collaboration**: Sharing is designed for thesis cohorts where students and supervisors need to exchange knowledge. It is not a general-purpose access control system.
- **Trust-based model**: Any authenticated user can share any of their memories. There is no approval workflow or moderation step.

### Technical Constraints
- **No ownership validation on share creation**: The `POST /api/v1/memories/share` endpoint does not verify that the requesting user owns the memory being shared. Any authenticated user can create a share for any memory ID. This is a potential authorization gap.
- **No duplicate share prevention**: The schema has no unique constraint on `(memoryId, sharedWithUserId)` or `(memoryId, sharedWithGroupId)`. A memory can be shared with the same user or group multiple times, creating duplicate share records.
- **Hard delete on unshare**: Unlike retention-based soft-delete for other resources, unsharing performs a hard `DELETE` from the `memoryShares` table. There is no audit trail of past shares.
- **Group membership resolved at query time**: The `getSharedMemories` function queries the user's current group memberships and finds shares matching those group IDs. This means access is dynamic — joining a group grants access to its shared memories, and leaving revokes it.
- **No pagination on shared memories**: `getSharedMemories` and `getMemoryShares` return all results without limit/offset support.
- **Share level is stored but not enforced**: The `level` field (`read`/`write`) is persisted in `memoryShares` but no API endpoint checks it. The `write` level does not grant update permissions on the shared memory. This makes the write level effectively meaningless in v1.

### Assumptions
- The `shared_read` MCP tool is the primary way agents access shared memories. Dashboard access is secondary.
- Group-based sharing is the more common pattern (share with a cohort) versus individual user shares.
- Memory content is the shared artifact; version history and tags are accessible on the memory object but shares do not grant access to modify versions.
- Cascade delete on the `memories` table means deleting a memory automatically removes all its share records.

## Questions & Open Items

- **Write-level semantics**: What should `write` level actually enable? Should recipients be able to edit the shared memory's content/tags, or only add comments/annotations? This needs to be defined before the `write` level has any meaning.
- **Ownership validation**: Should the share endpoint verify that the requesting user owns the memory (or is an admin)? Currently any authenticated user can share any memory by ID.
- **Duplicate prevention**: Should a unique constraint on `(memoryId, sharedWithUserId)` and `(memoryId, sharedWithGroupId)` be added to prevent duplicate shares? Or should duplicates be allowed (e.g., to upgrade from `read` to `write`)?
- **Pagination**: Should `getSharedMemories` and `getMemoryShares` support pagination? For users in many groups with many shared memories, the full result set could be large.
- **Share audit trail**: Should share/unshare actions be logged in the audit system? Currently there is no record that a memory was ever shared once it is unshared.
- **Notification on share**: Should recipients be notified (in-app, email, or webhook) when a memory is shared with them? This would improve discoverability of shared knowledge.
