import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  index,
  unique,
  jsonb,
  varchar,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Custom type for pgvector
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    return (value as string)
      .slice(1, -1)
      .split(",")
      .map(Number);
  },
});

// ─── Users ───────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("student"), // 'student' | 'admin'
  githubId: text("github_id").unique(),
  googleId: text("google_id").unique(),
  githubAccessTokenEnc: text("github_access_token_enc"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Personal Access Tokens ──────────────────────────────────────

export const personalAccessTokens = pgTable("personal_access_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Groups ──────────────────────────────────────────────────────

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Group Members ───────────────────────────────────────────────

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.groupId, table.userId)]
);

// ─── Projects ────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Memories ────────────────────────────────────────────────────

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    category: text("category").notNull().default("other"),
    sourceAgent: text("source_agent"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    isPinned: boolean("is_pinned").notNull().default(false),
    version: integer("version").notNull().default(1),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_memories_project").on(table.projectId),
    index("idx_memories_user").on(table.userId),
  ]
);

// ─── Memory Versions ─────────────────────────────────────────────

export const memoryVersions = pgTable(
  "memory_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memoryId: uuid("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    sourceAgent: text("source_agent"),
    changedBy: uuid("changed_by").references(() => users.id),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_memory_versions_memory").on(table.memoryId),
    index("idx_memory_versions_archived").on(table.archivedAt).where(sql`archived_at IS NULL`),
  ]
);

// ─── Memory Shares ───────────────────────────────────────────────

export const memoryShares = pgTable("memory_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoryId: uuid("memory_id")
    .notNull()
    .references(() => memories.id, { onDelete: "cascade" }),
  sharedWithUserId: uuid("shared_with_user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  sharedWithGroupId: uuid("shared_with_group_id").references(() => groups.id, {
    onDelete: "cascade",
  }),
  level: text("level").notNull().default("read"), // 'read' | 'write'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Sessions ────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentType: text("agent_type").notNull(),
    title: text("title"),
    summary: text("summary"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_sessions_project").on(table.projectId),
    index("idx_sessions_user").on(table.userId),
  ]
);

// ─── Session Events ──────────────────────────────────────────────

export const sessionEvents = pgTable(
  "session_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_session_events_session").on(table.sessionId),
    index("idx_session_events_archived").on(table.archivedAt).where(sql`archived_at IS NULL`),
  ]
);

// ─── Connected Repos ─────────────────────────────────────────────

export const connectedRepos = pgTable(
  "connected_repos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    githubRepoId: bigint("github_repo_id", { mode: "number" }).notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    webhookId: bigint("webhook_id", { mode: "number" }),
    webhookSecret: text("webhook_secret").notNull(),
    projectId: uuid("project_id").references(() => projects.id),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.userId, table.githubRepoId),
    index("idx_connected_repos_user").on(table.userId),
  ]
);

// ─── Repo Memory Files ───────────────────────────────────────────

export const repoMemoryFiles = pgTable(
  "repo_memory_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => connectedRepos.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    fileSha: text("file_sha"),
    agentType: text("agent_type"),
    memoryId: uuid("memory_id").references(() => memories.id, {
      onDelete: "set null",
    }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.repoId, table.filePath),
    index("idx_repo_files_repo").on(table.repoId),
  ]
);

// ─── Audit Logs ──────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_audit_logs_user").on(table.userId),
    index("idx_audit_logs_archived").on(table.archivedAt).where(sql`archived_at IS NULL`),
  ]
);

// ─── Retention Policies ─────────────────────────────────────────

export const retentionPolicies = pgTable("retention_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  resource: text("resource").notNull().unique(), // 'session_events' | 'memory_versions' | 'audit_logs'
  days: integer("days").notNull().default(90),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

// ─── Relations ───────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  memories: many(memories),
  sessions: many(sessions),
  personalAccessTokens: many(personalAccessTokens),
  connectedRepos: many(connectedRepos),
  groupMemberships: many(groupMembers),
}));

export const groupsRelations = relations(groups, ({ many, one }) => ({
  members: many(groupMembers),
  projects: many(projects),
  createdByUser: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  group: one(groups, {
    fields: [projects.groupId],
    references: [groups.id],
  }),
  memories: many(memories),
  sessions: many(sessions),
}));

export const memoriesRelations = relations(memories, ({ one, many }) => ({
  project: one(projects, {
    fields: [memories.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [memories.userId],
    references: [users.id],
  }),
  versions: many(memoryVersions),
  shares: many(memoryShares),
}));

export const memoryVersionsRelations = relations(memoryVersions, ({ one }) => ({
  memory: one(memories, {
    fields: [memoryVersions.memoryId],
    references: [memories.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [sessions.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  events: many(sessionEvents),
}));

export const sessionEventsRelations = relations(sessionEvents, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionEvents.sessionId],
    references: [sessions.id],
  }),
}));

export const connectedReposRelations = relations(connectedRepos, ({ one, many }) => ({
  user: one(users, {
    fields: [connectedRepos.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [connectedRepos.projectId],
    references: [projects.id],
  }),
  memoryFiles: many(repoMemoryFiles),
}));

export const repoMemoryFilesRelations = relations(repoMemoryFiles, ({ one }) => ({
  repo: one(connectedRepos, {
    fields: [repoMemoryFiles.repoId],
    references: [connectedRepos.id],
  }),
  memory: one(memories, {
    fields: [repoMemoryFiles.memoryId],
    references: [memories.id],
  }),
}));
