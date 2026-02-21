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
import { updateRetentionPolicySchema } from "@memai/shared";
import { db } from "../db/index.js";
import { users, groups, projects, memories, sessions } from "../db/schema.js";
import { sql } from "drizzle-orm";

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
}
