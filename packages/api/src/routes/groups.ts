import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { groups, groupMembers, users } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { createGroupSchema, updateGroupSchema, addGroupMemberSchema } from "@memai/shared";

export async function groupRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/groups",
    { preHandler: [authMiddleware] },
    async (request) => {
      if (request.userRole === "admin") {
        return db.query.groups.findMany({
          with: { members: { with: { user: true } } },
        });
      }

      // Students see only their groups
      const memberships = await db
        .select({ groupId: groupMembers.groupId })
        .from(groupMembers)
        .where(eq(groupMembers.userId, request.userId));

      const groupIds = memberships.map((m) => m.groupId);
      if (groupIds.length === 0) return [];

      return db.query.groups.findMany({
        where: (groups, { inArray }) => inArray(groups.id, groupIds),
        with: { members: { with: { user: true } } },
      });
    }
  );

  app.post(
    "/api/v1/groups",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const body = createGroupSchema.parse(request.body);

      const [group] = await db
        .insert(groups)
        .values({
          name: body.name,
          description: body.description,
          createdBy: request.userId,
        })
        .returning();

      // Add creator as member
      await db.insert(groupMembers).values({
        groupId: group.id,
        userId: request.userId,
      });

      return reply.status(201).send(group);
    }
  );

  app.patch(
    "/api/v1/groups/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateGroupSchema.parse(request.body);

      const [updated] = await db
        .update(groups)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(groups.id, id))
        .returning();

      if (!updated) return reply.status(404).send({ error: "Group not found" });
      return updated;
    }
  );

  app.delete(
    "/api/v1/groups/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await db.delete(groups).where(eq(groups.id, id));
      return reply.status(204).send();
    }
  );

  // Members
  app.post(
    "/api/v1/groups/:id/members",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = addGroupMemberSchema.parse(request.body);

      const [member] = await db
        .insert(groupMembers)
        .values({ groupId: id, userId: body.userId })
        .onConflictDoNothing()
        .returning();

      return reply.status(201).send(member || { message: "Already a member" });
    }
  );

  app.delete(
    "/api/v1/groups/:id/members/:userId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      await db
        .delete(groupMembers)
        .where(
          eq(groupMembers.groupId, id)
        );
      return reply.status(204).send();
    }
  );
}
