import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { projects, groupMembers } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { exportSchema } from "@memai/shared";
import { exportProjectMemories } from "../services/export.service.js";

export async function exportRoutes(app: FastifyInstance) {
  app.post(
    "/api/v1/export",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const body = exportSchema.parse(request.body);

      // Access check: students can only export projects they belong to
      if (request.userRole !== "admin") {
        const project = await db.query.projects.findFirst({
          where: eq(projects.id, body.projectId),
        });
        if (!project) return reply.status(404).send({ error: "Project not found" });

        const membership = await db.query.groupMembers.findFirst({
          where: (gm, { and, eq: eq_ }) =>
            and(eq_(gm.groupId, project.groupId), eq_(gm.userId, request.userId)),
        });
        if (!membership) {
          return reply.status(403).send({ error: "You can only export projects you belong to" });
        }
      }

      const content = await exportProjectMemories(body.projectId, body.format);

      const contentTypes: Record<string, string> = {
        json: "application/json",
        "claude-md": "text/markdown",
        "gemini-md": "text/markdown",
        cursorrules: "text/plain",
        "skill-md": "text/markdown",
        report: "text/markdown",
      };

      return reply
        .header("Content-Type", contentTypes[body.format] || "text/plain")
        .send(content);
    }
  );
}
