import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/rbac.js";
import { updateUserSchema } from "@memai/shared";

export async function userRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/users",
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request) => {
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users);
      return allUsers;
    }
  );

  app.get(
    "/api/v1/users/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Students can only view themselves
      if (request.userRole !== "admin" && request.userId !== id) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) return reply.status(404).send({ error: "User not found" });
      return user;
    }
  );

  app.patch(
    "/api/v1/users/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateUserSchema.parse(request.body);

      // Only admins can change roles
      if (body.role && request.userRole !== "admin") {
        return reply.status(403).send({ error: "Only admins can change roles" });
      }

      // Students can only update themselves
      if (request.userRole !== "admin" && request.userId !== id) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const [updated] = await db
        .update(users)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      if (!updated) return reply.status(404).send({ error: "User not found" });
      const { githubAccessTokenEnc, ...safeUser } = updated;
      return safeUser;
    }
  );
}
