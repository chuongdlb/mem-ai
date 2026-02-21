import { eq, sql, and, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  retentionPolicies,
  sessionEvents,
  memoryVersions,
  auditLogs,
} from "../db/schema.js";

const BATCH_SIZE = 1000;

const tableMap = {
  session_events: sessionEvents,
  memory_versions: memoryVersions,
  audit_logs: auditLogs,
} as const;

type ResourceType = keyof typeof tableMap;

export async function getRetentionPolicies() {
  return db.select().from(retentionPolicies);
}

export async function updateRetentionPolicy(
  resource: string,
  updates: { days?: number; enabled?: boolean },
  updatedBy: string
) {
  const [updated] = await db
    .update(retentionPolicies)
    .set({
      ...updates,
      updatedBy,
      updatedAt: new Date(),
    })
    .where(eq(retentionPolicies.resource, resource))
    .returning();

  return updated;
}

export async function archiveExpiredRows(
  resource: string,
  days: number
): Promise<number> {
  const table = tableMap[resource as ResourceType];
  if (!table) return 0;

  const cutoff = sql`now() - ${days + " days"}::interval`;

  // Batch archive to avoid long locks
  let totalArchived = 0;
  let batchArchived: number;

  do {
    const result = await db.execute<{ id: string }>(sql`
      UPDATE ${table}
      SET archived_at = now()
      WHERE id IN (
        SELECT id FROM ${table}
        WHERE created_at < ${cutoff}
          AND archived_at IS NULL
        LIMIT ${BATCH_SIZE}
      )
      RETURNING id
    `);

    batchArchived = result.length;
    totalArchived += batchArchived;
  } while (batchArchived === BATCH_SIZE);

  return totalArchived;
}

export async function getRetentionStats() {
  const stats: Record<string, { active: number; archived: number }> = {};

  for (const [resource, table] of Object.entries(tableMap)) {
    const [activeResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(isNull(table.archivedAt));

    const [archivedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(sql`${table.archivedAt} IS NOT NULL`);

    stats[resource] = {
      active: Number(activeResult.count),
      archived: Number(archivedResult.count),
    };
  }

  return stats;
}

export async function runRetentionCleanup(
  logger?: { info: (obj: Record<string, unknown>, msg: string) => void }
): Promise<Record<string, number>> {
  const policies = await getRetentionPolicies();
  const results: Record<string, number> = {};

  for (const policy of policies) {
    if (!policy.enabled) continue;
    const archived = await archiveExpiredRows(policy.resource, policy.days);
    results[policy.resource] = archived;
    if (archived > 0 && logger) {
      logger.info(
        { resource: policy.resource, archived },
        "Retention cleanup"
      );
    }
  }

  return results;
}
