import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, sessionEvents } from "../db/schema.js";

export async function createSession(input: {
  projectId: string;
  userId: string;
  agentType: string;
  title?: string;
}) {
  const [session] = await db
    .insert(sessions)
    .values({
      projectId: input.projectId,
      userId: input.userId,
      agentType: input.agentType,
      title: input.title,
    })
    .returning();

  return session;
}

export async function getSession(sessionId: string) {
  return db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
    with: {
      events: {
        where: isNull(sessionEvents.archivedAt),
        orderBy: [sessionEvents.createdAt],
      },
    },
  });
}

export async function listSessions(opts: {
  projectId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  if (opts.projectId) conditions.push(eq(sessions.projectId, opts.projectId));
  if (opts.userId) conditions.push(eq(sessions.userId, opts.userId));

  return db.query.sessions.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(sessions.startedAt)],
    limit: opts.limit || 20,
    offset: opts.offset || 0,
  });
}

export async function endSession(sessionId: string, summary?: string) {
  const [updated] = await db
    .update(sessions)
    .set({
      endedAt: new Date(),
      summary,
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  return updated;
}

export async function addSessionEvent(input: {
  sessionId: string;
  eventType: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const [event] = await db
    .insert(sessionEvents)
    .values({
      sessionId: input.sessionId,
      eventType: input.eventType,
      content: input.content,
      metadata: input.metadata,
    })
    .returning();

  return event;
}

export async function listSessionEvents(sessionId: string) {
  return db.query.sessionEvents.findMany({
    where: and(
      eq(sessionEvents.sessionId, sessionId),
      isNull(sessionEvents.archivedAt)
    ),
    orderBy: [sessionEvents.createdAt],
  });
}
