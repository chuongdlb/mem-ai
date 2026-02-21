import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { exportSchema } from "@memai/shared";
import { exportProjectMemories } from "../services/export.service.js";

export async function exportRoutes(app: FastifyInstance) {
  app.post(
    "/api/v1/export",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const body = exportSchema.parse(request.body);
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
