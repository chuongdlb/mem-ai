import type { FastifyRequest, FastifyReply } from "fastify";

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.userRole)) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }
  };
}

export function requireAdmin() {
  return requireRole("admin");
}
