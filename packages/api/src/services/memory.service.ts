import { eq, and, desc, ilike, or, sql, inArray, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  memories,
  memoryVersions,
  memoryShares,
  groupMembers,
} from "../db/schema.js";

export interface CreateMemoryInput {
  projectId: string;
  userId: string;
  title: string;
  content: string;
  category?: string;
  sourceAgent?: string;
  tags?: string[];
}

export interface UpdateMemoryInput {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  isPinned?: boolean;
}

export async function createMemory(input: CreateMemoryInput) {
  const [memory] = await db
    .insert(memories)
    .values({
      projectId: input.projectId,
      userId: input.userId,
      title: input.title,
      content: input.content,
      category: input.category || "other",
      sourceAgent: input.sourceAgent,
      tags: input.tags || [],
    })
    .returning();

  // Create initial version
  await db.insert(memoryVersions).values({
    memoryId: memory.id,
    version: 1,
    title: memory.title,
    content: memory.content,
    sourceAgent: memory.sourceAgent,
    changedBy: input.userId,
    changeReason: input.sourceAgent ? "mcp_write" : "manual_edit",
  });

  return memory;
}

export async function getMemory(memoryId: string) {
  return db.query.memories.findFirst({
    where: eq(memories.id, memoryId),
  });
}

export async function listMemories(opts: {
  projectId?: string;
  userId?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  if (opts.projectId) conditions.push(eq(memories.projectId, opts.projectId));
  if (opts.userId) conditions.push(eq(memories.userId, opts.userId));
  if (opts.category) conditions.push(eq(memories.category, opts.category));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db.query.memories.findMany({
    where,
    orderBy: [desc(memories.updatedAt)],
    limit: opts.limit || 20,
    offset: opts.offset || 0,
  });
}

export async function updateMemory(
  memoryId: string,
  userId: string,
  input: UpdateMemoryInput,
  changeReason: string = "manual_edit"
) {
  const existing = await getMemory(memoryId);
  if (!existing) throw new Error("Memory not found");

  const newVersion = existing.version + 1;

  const [updated] = await db
    .update(memories)
    .set({
      ...input,
      version: newVersion,
      updatedAt: new Date(),
    })
    .where(eq(memories.id, memoryId))
    .returning();

  // Create version record
  await db.insert(memoryVersions).values({
    memoryId,
    version: newVersion,
    title: updated.title,
    content: updated.content,
    sourceAgent: updated.sourceAgent,
    changedBy: userId,
    changeReason,
  });

  return updated;
}

export async function deleteMemory(memoryId: string) {
  await db.delete(memories).where(eq(memories.id, memoryId));
}

export async function searchMemories(opts: {
  query: string;
  projectId?: string;
  userId?: string;
  category?: string;
  limit?: number;
}) {
  const conditions = [];

  // Full-text search on title and content
  conditions.push(
    or(
      ilike(memories.title, `%${opts.query}%`),
      ilike(memories.content, `%${opts.query}%`)
    )!
  );

  if (opts.projectId) conditions.push(eq(memories.projectId, opts.projectId));
  if (opts.userId) conditions.push(eq(memories.userId, opts.userId));
  if (opts.category) conditions.push(eq(memories.category, opts.category));

  return db.query.memories.findMany({
    where: and(...conditions),
    orderBy: [desc(memories.updatedAt)],
    limit: opts.limit || 20,
  });
}

export async function getSharedMemories(userId: string) {
  // Get groups the user belongs to
  const userGroups = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const groupIds = userGroups.map((g) => g.groupId);

  const conditions = [eq(memoryShares.sharedWithUserId, userId)];
  if (groupIds.length > 0) {
    conditions.push(inArray(memoryShares.sharedWithGroupId, groupIds));
  }

  const shares = await db
    .select({ memoryId: memoryShares.memoryId })
    .from(memoryShares)
    .where(or(...conditions));

  if (shares.length === 0) return [];

  const memoryIds = shares.map((s) => s.memoryId);
  return db.query.memories.findMany({
    where: inArray(memories.id, memoryIds),
    orderBy: [desc(memories.updatedAt)],
  });
}

export async function getMemoryVersions(memoryId: string) {
  return db.query.memoryVersions.findMany({
    where: and(
      eq(memoryVersions.memoryId, memoryId),
      isNull(memoryVersions.archivedAt)
    ),
    orderBy: [desc(memoryVersions.version)],
  });
}
