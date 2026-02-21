import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";

export function auditLog(action: string, resourceType: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Only log successful responses (2xx/3xx)
    if (reply.statusCode >= 400) return;

    db.insert(auditLogs)
      .values({
        userId: request.userId,
        action,
        resourceType,
        resourceId: (request.params as Record<string, string>)?.id,
        ipAddress: request.ip,
      })
      .catch((err) => {
        request.log.error(err, "Failed to write audit log");
      });
  };
}
