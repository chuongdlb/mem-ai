import type {
  AGENT_TYPES,
  CHANGE_REASONS,
  EXPORT_FORMATS,
  MEMORY_CATEGORIES,
  ROLES,
  SESSION_EVENT_TYPES,
  SHARE_LEVELS,
} from "./constants.js";

export type AgentType = (typeof AGENT_TYPES)[number];
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
export type SessionEventType = (typeof SESSION_EVENT_TYPES)[number];
export type ChangeReason = (typeof CHANGE_REASONS)[number];
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export type Role = (typeof ROLES)[number];
export type ShareLevel = (typeof SHARE_LEVELS)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: Role;
  githubId?: string;
  googleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  groupId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Memory {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  content: string;
  category: MemoryCategory;
  sourceAgent?: AgentType;
  tags: string[];
  isPinned: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryVersion {
  id: string;
  memoryId: string;
  version: number;
  title: string;
  content: string;
  sourceAgent?: string;
  changedBy: string;
  changeReason: ChangeReason;
  createdAt: string;
  archivedAt?: string;
}

export interface Session {
  id: string;
  projectId: string;
  userId: string;
  agentType: AgentType;
  title?: string;
  summary?: string;
  startedAt: string;
  endedAt?: string;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  eventType: SessionEventType;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  archivedAt?: string;
}

export interface ConnectedRepo {
  id: string;
  userId: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  webhookId?: number;
  projectId?: string;
  isActive: boolean;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface RepoMemoryFile {
  id: string;
  repoId: string;
  filePath: string;
  fileSha?: string;
  agentType?: AgentType;
  memoryId?: string;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface PersonalAccessToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface MemoryShare {
  id: string;
  memoryId: string;
  sharedWithUserId?: string;
  sharedWithGroupId?: string;
  level: ShareLevel;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  archivedAt?: string;
}

export interface RetentionPolicy {
  id: string;
  resource: string;
  days: number;
  enabled: boolean;
  updatedAt: string;
  updatedBy?: string;
}
