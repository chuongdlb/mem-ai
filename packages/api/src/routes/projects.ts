import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { auditLog } from "../middleware/audit.js";
import { createProjectSchema, updateProjectSchema } from "@memai/shared";

export async function projectRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/projects",
    { preHandler: [authMiddleware] },
    async () => {
      return db.query.projects.findMany({
        with: { group: true },
      });
    }
  );

  app.get(
    "/api/v1/projects/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, id),
        with: { group: true, memories: true, sessions: true },
      });
      if (!project) return reply.status(404).send({ error: "Project not found" });
      return project;
    }
  );

  app.post(
    "/api/v1/projects",
    { preHandler: [authMiddleware], onResponse: auditLog("create", "project") },
    async (request, reply) => {
      const body = createProjectSchema.parse(request.body);
      const [project] = await db
        .insert(projects)
        .values(body)
        .returning();
      return reply.status(201).send(project);
    }
  );

  app.patch(
    "/api/v1/projects/:id",
    { preHandler: [authMiddleware], onResponse: auditLog("update", "project") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateProjectSchema.parse(request.body);
      const [updated] = await db
        .update(projects)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();
      if (!updated) return reply.status(404).send({ error: "Project not found" });
      return updated;
    }
  );

  app.delete(
    "/api/v1/projects/:id",
    { preHandler: [authMiddleware], onResponse: auditLog("delete", "project") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await db.delete(projects).where(eq(projects.id, id));
      return reply.status(204).send();
    }
  );
}
