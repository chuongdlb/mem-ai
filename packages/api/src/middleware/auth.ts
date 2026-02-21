import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { verifyJwt, type JwtPayload } from "../auth/jwt.js";
import { hashPat } from "../auth/pat.js";
import { db } from "../db/index.js";
import { personalAccessTokens, users } from "../db/schema.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    userRole: string;
    userEmail: string;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme === "Bearer" && token) {
    // Try JWT first
    try {
      const payload = verifyJwt(token);
      request.userId = payload.sub;
      request.userRole = payload.role;
      request.userEmail = payload.email;
      return;
    } catch {
      // Not a JWT, try PAT
    }

    // Try PAT
    const tokenHash = hashPat(token);
    const [pat] = await db
      .select()
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.tokenHash, tokenHash))
      .limit(1);

    if (pat) {
      // Check expiry
      if (pat.expiresAt && pat.expiresAt < new Date()) {
        return reply.status(401).send({ error: "Token expired" });
      }

      // Update last used
      await db
        .update(personalAccessTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(personalAccessTokens.id, pat.id));

      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, pat.userId))
        .limit(1);

      if (user) {
        request.userId = user.id;
        request.userRole = user.role;
        request.userEmail = user.email;
        return;
      }
    }
  }

  return reply.status(401).send({ error: "Invalid token" });
}
