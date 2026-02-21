import { z } from "zod";
import {
  AGENT_TYPES,
  CHANGE_REASONS,
  EXPORT_FORMATS,
  MEMORY_CATEGORIES,
  ROLES,
  SESSION_EVENT_TYPES,
  SHARE_LEVELS,
} from "./constants.js";

// Auth
export const loginCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

export const createPatSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().positive().optional(),
});

// Users
export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(ROLES).optional(),
});

// Groups
export const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

export const updateGroupSchema = createGroupSchema.partial();

export const addGroupMemberSchema = z.object({
  userId: z.string().uuid(),
});

// Projects
export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  groupId: z.string().uuid(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

// Memories
export const createMemorySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  category: z.enum(MEMORY_CATEGORIES).default("other"),
  sourceAgent: z.enum(AGENT_TYPES).optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

export const updateMemorySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  category: z.enum(MEMORY_CATEGORIES).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isPinned: z.boolean().optional(),
});

export const searchMemoriesSchema = z.object({
  query: z.string().min(1),
  projectId: z.string().uuid().optional(),
  category: z.enum(MEMORY_CATEGORIES).optional(),
  sourceAgent: z.enum(AGENT_TYPES).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// Sessions
export const createSessionSchema = z.object({
  projectId: z.string().uuid(),
  agentType: z.enum(AGENT_TYPES),
  title: z.string().max(500).optional(),
});

export const endSessionSchema = z.object({
  summary: z.string().max(5000).optional(),
});

export const createSessionEventSchema = z.object({
  sessionId: z.string().uuid(),
  eventType: z.enum(SESSION_EVENT_TYPES),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

// Sharing
export const shareMemorySchema = z.object({
  memoryId: z.string().uuid(),
  sharedWithUserId: z.string().uuid().optional(),
  sharedWithGroupId: z.string().uuid().optional(),
  level: z.enum(SHARE_LEVELS).default("read"),
}).refine(
  (data) => data.sharedWithUserId || data.sharedWithGroupId,
  "Must share with either a user or a group"
);

// Repos
export const connectRepoSchema = z.object({
  githubRepoId: z.number().int(),
  owner: z.string().min(1),
  name: z.string().min(1),
  fullName: z.string().min(1),
  defaultBranch: z.string().default("main"),
  projectId: z.string().uuid().optional(),
});

export const pushToRepoSchema = z.object({
  memoryId: z.string().uuid(),
  filePath: z.string().min(1),
});

// Export
export const exportSchema = z.object({
  projectId: z.string().uuid(),
  format: z.enum(EXPORT_FORMATS),
});

// MCP-specific schemas
export const mcpMemoryWriteSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  category: z.enum(MEMORY_CATEGORIES).default("other"),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

export const mcpMemoryReadSchema = z.object({
  memoryId: z.string().uuid().optional(),
  category: z.enum(MEMORY_CATEGORIES).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const mcpMemorySearchSchema = z.object({
  query: z.string().min(1),
  category: z.enum(MEMORY_CATEGORIES).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const mcpMemoryDeleteSchema = z.object({
  memoryId: z.string().uuid(),
});

export const mcpSessionLogSchema = z.object({
  sessionId: z.string().uuid(),
  eventType: z.enum(SESSION_EVENT_TYPES),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const mcpSessionEndSchema = z.object({
  sessionId: z.string().uuid(),
  summary: z.string().max(5000).optional(),
});

// Retention policies
export const updateRetentionPolicySchema = z.object({
  days: z.number().int().min(1).max(3650).optional(),
  enabled: z.boolean().optional(),
});

// Version history
export const memoryVersionSchema = z.object({
  memoryId: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  sourceAgent: z.string().optional(),
  changedBy: z.string().uuid(),
  changeReason: z.enum(CHANGE_REASONS),
});
