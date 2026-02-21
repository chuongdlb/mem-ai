import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { createSessionSchema, endSessionSchema, createSessionEventSchema } from "@memai/shared";
import * as sessionService from "../services/session.service.js";

export async function sessionRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/sessions",
    { preHandler: [authMiddleware] },
    async (request) => {
      const query = request.query as {
        projectId?: string;
        limit?: string;
        offset?: string;
      };
      return sessionService.listSessions({
        projectId: query.projectId,
        userId: request.userRole === "admin" ? undefined : request.userId,
        limit: query.limit ? parseInt(query.limit) : undefined,
        offset: query.offset ? parseInt(query.offset) : undefined,
      });
    }
  );

  app.get(
    "/api/v1/sessions/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = await sessionService.getSession(id);
      if (!session) return reply.status(404).send({ error: "Session not found" });
      return session;
    }
  );

  app.post(
    "/api/v1/sessions",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const body = createSessionSchema.parse(request.body);
      const session = await sessionService.createSession({
        ...body,
        userId: request.userId,
      });
      return reply.status(201).send(session);
    }
  );

  app.post(
    "/api/v1/sessions/:id/end",
    { preHandler: [authMiddleware] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = endSessionSchema.parse(request.body);
      return sessionService.endSession(id, body.summary);
    }
  );

  // Events
  app.get(
    "/api/v1/sessions/:id/events",
    { preHandler: [authMiddleware] },
    async (request) => {
      const { id } = request.params as { id: string };
      return sessionService.listSessionEvents(id);
    }
  );

  app.post(
    "/api/v1/sessions/events",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const body = createSessionEventSchema.parse(request.body);
      const event = await sessionService.addSessionEvent(body);
      return reply.status(201).send(event);
    }
  );
}
