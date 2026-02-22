import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/rbac.js";
import { getAuditLogs } from "../services/audit.service.js";
import {
  getRetentionPolicies,
  updateRetentionPolicy,
  getRetentionStats,
  runRetentionCleanup,
} from "../services/retention.service.js";
import {
  generateEmbedding,
  isEmbeddingEnabled,
  getProviderModel,
} from "../services/embedding.service.js";
import { updateRetentionPolicySchema } from "@memai/shared";
import { db } from "../db/index.js";
import { users, groups, projects, memories, sessions } from "../db/schema.js";
import { sql, eq, or, isNull } from "drizzle-orm";

export async function adminRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/admin/stats",
    { preHandler: [authMiddleware, requireAdmin()] },
    async () => {
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [groupCount] = await db.select({ count: sql<number>`count(*)` }).from(groups);
      const [projectCount] = await db.select({ count: sql<number>`count(*)` }).from(projects);
      const [memoryCount] = await db.select({ count: sql<number>`count(*)` }).from(memories);
      const [sessionCount] = await db.select({ count: sql<number>`count(*)` }).from(sessions);

      return {
        users: Number(userCount.count),
        groups: Number(groupCount.count),
        projects: Number(projectCount.count),
        memories: Number(memoryCount.count),
        sessions: Number(sessionCount.count),
      };
    }
  );

  app.get(
    "/api/v1/admin/audit",
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request) => {
      const query = request.query as {
        userId?: string;
        resourceType?: string;
        limit?: string;
        offset?: string;
      };

      return getAuditLogs({
        userId: query.userId,
        resourceType: query.resourceType,
        limit: query.limit ? parseInt(query.limit) : undefined,
        offset: query.offset ? parseInt(query.offset) : undefined,
      });
    }
  );

  // ─── Retention Policy Endpoints ─────────────────────────────────

  app.get(
    "/api/v1/admin/retention",
    { preHandler: [authMiddleware, requireAdmin()] },
    async () => {
      return getRetentionPolicies();
    }
  );

  app.patch(
    "/api/v1/admin/retention/:resource",
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      const { resource } = request.params as { resource: string };
      const body = updateRetentionPolicySchema.parse(request.body);

      const updated = await updateRetentionPolicy(
        resource,
        body,
        request.userId
      );

      if (!updated) {
        return reply.status(404).send({ error: "Policy not found" });
      }

      return updated;
    }
  );

  app.get(
    "/api/v1/admin/retention/stats",
    { preHandler: [authMiddleware, requireAdmin()] },
    async () => {
      return getRetentionStats();
    }
  );

  app.post(
    "/api/v1/admin/retention/run",
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request) => {
      const results = await runRetentionCleanup(request.log);
      return { archived: results };
    }
  );

  // ─── Embedding Backfill ──────────────────────────────────────────

  app.post(
    "/api/v1/admin/embeddings/backfill",
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      if (!isEmbeddingEnabled()) {
        return reply.status(400).send({
          error: "Embedding provider is disabled (EMBEDDING_PROVIDER=none)",
        });
      }

      const query = request.query as { limit?: string };
      const batchLimit = query.limit ? parseInt(query.limit) : 100;
      const currentModel = getProviderModel();

      // Find memories with no embedding or stale model
      const toBackfill = await db
        .select({
          id: memories.id,
          title: memories.title,
          content: memories.content,
        })
        .from(memories)
        .where(
          or(
            isNull(memories.embedding),
            sql`${memories.embeddingModel} != ${currentModel}`
          )
        )
        .limit(batchLimit);

      let succeeded = 0;
      let failed = 0;

      for (const memory of toBackfill) {
        try {
          const text = `${memory.title}\n\n${memory.content}`;
          const embedding = await generateEmbedding(text);
          await db
            .update(memories)
            .set({ embedding, embeddingModel: currentModel })
            .where(eq(memories.id, memory.id));
          succeeded++;
        } catch (err) {
          request.log.error({ memoryId: memory.id, err }, "Backfill failed for memory");
          failed++;
        }
      }

      return {
        total: toBackfill.length,
        succeeded,
        failed,
        model: currentModel,
      };
    }
  );
}
