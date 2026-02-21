import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";

export function auditLog(action: string, resourceType: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Log after the response is sent
    reply.then(
      () => {
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
      },
      () => {
        // do nothing on error
      }
    );
  };
}
