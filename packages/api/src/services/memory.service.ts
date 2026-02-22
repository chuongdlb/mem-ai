import { eq, and, desc, ilike, or, sql, inArray, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  memories,
  memoryVersions,
  memoryShares,
  groupMembers,
} from "../db/schema.js";
import {
  generateEmbedding,
  isEmbeddingEnabled,
  isEmbeddingAvailable,
  getProviderModel,
} from "./embedding.service.js";

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

// ─── Embedding helper ────────────────────────────────────────────

async function tryGenerateEmbedding(
  title: string,
  content: string
): Promise<{ embedding: number[]; model: string } | null> {
  if (!isEmbeddingEnabled()) return null;

  try {
    const available = await isEmbeddingAvailable();
    if (!available) return null;

    const text = `${title}\n\n${content}`;
    const embedding = await generateEmbedding(text);
    return { embedding, model: getProviderModel() };
  } catch (err) {
    console.error("[embedding] Failed to generate embedding:", err);
    return null;
  }
}

// ─── CRUD ────────────────────────────────────────────────────────

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

  // Best-effort embedding generation
  const result = await tryGenerateEmbedding(memory.title, memory.content);
  if (result) {
    const [updated] = await db
      .update(memories)
      .set({
        embedding: result.embedding,
        embeddingModel: result.model,
      })
      .where(eq(memories.id, memory.id))
      .returning();
    return updated;
  }

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

  // Re-generate embedding if title or content changed
  const contentChanged =
    (input.title !== undefined && input.title !== existing.title) ||
    (input.content !== undefined && input.content !== existing.content);

  if (contentChanged) {
    const result = await tryGenerateEmbedding(updated.title, updated.content);
    if (result) {
      const [withEmbedding] = await db
        .update(memories)
        .set({
          embedding: result.embedding,
          embeddingModel: result.model,
        })
        .where(eq(memories.id, memoryId))
        .returning();
      return withEmbedding;
    }
  }

  return updated;
}

export async function deleteMemory(memoryId: string) {
  await db.delete(memories).where(eq(memories.id, memoryId));
}

// ─── Search ──────────────────────────────────────────────────────

function textOnlySearch(opts: {
  query: string;
  projectId?: string;
  userId?: string;
  category?: string;
  limit?: number;
}) {
  const conditions = [];

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

async function hybridSearch(opts: {
  query: string;
  projectId?: string;
  userId?: string;
  category?: string;
  limit?: number;
}): Promise<Array<typeof memories.$inferSelect>> {
  const queryEmbedding = await generateEmbedding(opts.query);
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  const currentModel = getProviderModel();
  const limit = opts.limit || 20;
  const queryPattern = `%${opts.query}%`;

  const filters = [];
  if (opts.projectId) filters.push(sql`m.project_id = ${opts.projectId}`);
  if (opts.userId) filters.push(sql`m.user_id = ${opts.userId}`);
  if (opts.category) filters.push(sql`m.category = ${opts.category}`);

  const extraWhere =
    filters.length > 0
      ? sql`AND ${sql.join(filters, sql` AND `)}`
      : sql``;

  const result = await db.execute<typeof memories.$inferSelect>(sql`
    SELECT m.*
    FROM memories m
    WHERE (
      (m.embedding IS NOT NULL AND m.embedding_model = ${currentModel})
      OR m.title ILIKE ${queryPattern}
      OR m.content ILIKE ${queryPattern}
    )
    ${extraWhere}
    ORDER BY (
      CASE
        WHEN m.embedding IS NOT NULL AND m.embedding_model = ${currentModel}
        THEN (1.0 - (m.embedding <=> ${vectorStr}::vector))
        ELSE 0
      END * 0.7
      + CASE
        WHEN m.title ILIKE ${queryPattern} OR m.content ILIKE ${queryPattern}
        THEN 1
        ELSE 0
      END * 0.3
    ) DESC
    LIMIT ${limit}
  `);

  return result as unknown as Array<typeof memories.$inferSelect>;
}

export async function searchMemories(opts: {
  query: string;
  projectId?: string;
  userId?: string;
  category?: string;
  limit?: number;
}) {
  // Try hybrid search if embedding provider is enabled and available
  if (isEmbeddingEnabled()) {
    try {
      const available = await isEmbeddingAvailable();
      if (available) {
        return await hybridSearch(opts);
      }
    } catch (err) {
      console.error("[search] Hybrid search failed, falling back to text:", err);
    }
  }

  return textOnlySearch(opts);
}

// ─── Sharing ─────────────────────────────────────────────────────

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
