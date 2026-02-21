import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { auditLog } from "../middleware/audit.js";
import {
  createMemorySchema,
  updateMemorySchema,
  searchMemoriesSchema,
  shareMemorySchema,
} from "@memai/shared";
import * as memoryService from "../services/memory.service.js";
import * as sharingService from "../services/sharing.service.js";

export async function memoryRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/memories",
    { preHandler: [authMiddleware] },
    async (request) => {
      const query = request.query as {
        projectId?: string;
        category?: string;
        limit?: string;
        offset?: string;
      };
      return memoryService.listMemories({
        projectId: query.projectId,
        userId: request.userRole === "admin" ? undefined : request.userId,
        category: query.category,
        limit: query.limit ? parseInt(query.limit) : undefined,
        offset: query.offset ? parseInt(query.offset) : undefined,
      });
    }
  );

  app.get(
    "/api/v1/memories/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const memory = await memoryService.getMemory(id);
      if (!memory) return reply.status(404).send({ error: "Memory not found" });
      return memory;
    }
  );

  app.post(
    "/api/v1/memories",
    { preHandler: [authMiddleware], onResponse: auditLog("create", "memory") },
    async (request, reply) => {
      const body = createMemorySchema.parse(request.body);
      const memory = await memoryService.createMemory({
        ...body,
        userId: request.userId,
      });
      return reply.status(201).send(memory);
    }
  );

  app.patch(
    "/api/v1/memories/:id",
    { preHandler: [authMiddleware], onResponse: auditLog("update", "memory") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateMemorySchema.parse(request.body);
      const updated = await memoryService.updateMemory(id, request.userId, body);
      return updated;
    }
  );

  app.delete(
    "/api/v1/memories/:id",
    { preHandler: [authMiddleware], onResponse: auditLog("delete", "memory") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await memoryService.deleteMemory(id);
      return reply.status(204).send();
    }
  );

  // Search
  app.post(
    "/api/v1/memories/search",
    { preHandler: [authMiddleware] },
    async (request) => {
      const body = searchMemoriesSchema.parse(request.body);
      return memoryService.searchMemories({
        ...body,
        userId: request.userRole === "admin" ? undefined : request.userId,
      });
    }
  );

  // Version history
  app.get(
    "/api/v1/memories/:id/versions",
    { preHandler: [authMiddleware] },
    async (request) => {
      const { id } = request.params as { id: string };
      return memoryService.getMemoryVersions(id);
    }
  );

  // Sharing
  app.post(
    "/api/v1/memories/share",
    { preHandler: [authMiddleware], onResponse: auditLog("share", "memory") },
    async (request, reply) => {
      const body = shareMemorySchema.parse(request.body);

      // Verify the requesting user owns the memory (admins can share any)
      if (request.userRole !== "admin") {
        const memory = await memoryService.getMemory(body.memoryId);
        if (!memory) return reply.status(404).send({ error: "Memory not found" });
        if (memory.userId !== request.userId) {
          return reply.status(403).send({ error: "You can only share your own memories" });
        }
      }

      const share = await sharingService.shareMemory(body);
      return reply.status(201).send(share);
    }
  );

  app.get(
    "/api/v1/memories/shared",
    { preHandler: [authMiddleware] },
    async (request) => {
      return memoryService.getSharedMemories(request.userId);
    }
  );

  app.get(
    "/api/v1/memories/:id/shares",
    { preHandler: [authMiddleware] },
    async (request) => {
      const { id } = request.params as { id: string };
      return sharingService.getMemoryShares(id);
    }
  );

  app.delete(
    "/api/v1/memories/shares/:shareId",
    { preHandler: [authMiddleware], onResponse: auditLog("unshare", "memory") },
    async (request, reply) => {
      const { shareId } = request.params as { shareId: string };
      await sharingService.unshareMemory(shareId);
      return reply.status(204).send();
    }
  );
}
