import { desc, eq, and, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";

export async function logAudit(input: {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await db.insert(auditLogs).values(input);
}

export async function getAuditLogs(opts: {
  userId?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [isNull(auditLogs.archivedAt)];
  if (opts.userId) conditions.push(eq(auditLogs.userId, opts.userId));
  if (opts.resourceType)
    conditions.push(eq(auditLogs.resourceType, opts.resourceType));

  return db.query.auditLogs.findMany({
    where: and(...conditions),
    orderBy: [desc(auditLogs.createdAt)],
    limit: opts.limit || 50,
    offset: opts.offset || 0,
  });
}
