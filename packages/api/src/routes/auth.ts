import type { FastifyInstance } from "fastify";
import { eq, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "../db/index.js";
import { users, personalAccessTokens } from "../db/schema.js";
import { getGitHubAuthUrl, exchangeGitHubCode, getGitHubUser } from "../auth/github.js";
import { getGoogleAuthUrl, exchangeGoogleCode, getGoogleUser } from "../auth/google.js";
import { signJwt } from "../auth/jwt.js";
import { generatePat } from "../auth/pat.js";
import { encryptToken } from "../services/github.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { createPatSchema } from "@memai/shared";

export async function authRoutes(app: FastifyInstance) {
  // ── GitHub OAuth ─────────────────────────────────────────────

  app.get("/api/v1/auth/github", async (request, reply) => {
    const state = randomBytes(16).toString("hex");
    // In production, store state in a short-lived cookie/session for CSRF protection
    return reply.redirect(getGitHubAuthUrl(state));
  });

  app.get("/api/v1/auth/github/callback", async (request, reply) => {
    const { code } = request.query as { code: string };
    if (!code) return reply.status(400).send({ error: "Missing code" });

    const accessToken = await exchangeGitHubCode(code);
    const ghUser = await getGitHubUser(accessToken);

    // Upsert user
    let [user] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.githubId, ghUser.githubId),
          eq(users.email, ghUser.email)
        )
      )
      .limit(1);

    if (user) {
      [user] = await db
        .update(users)
        .set({
          githubId: ghUser.githubId,
          name: ghUser.name,
          avatarUrl: ghUser.avatarUrl,
          githubAccessTokenEnc: encryptToken(accessToken),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
    } else {
      [user] = await db
        .insert(users)
        .values({
          email: ghUser.email,
          name: ghUser.name,
          avatarUrl: ghUser.avatarUrl,
          githubId: ghUser.githubId,
          githubAccessTokenEnc: encryptToken(accessToken),
          role: "student",
        })
        .returning();
    }

    const jwt = signJwt({ sub: user.id, email: user.email, role: user.role });

    // Redirect to dashboard with token
    const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:5173";
    return reply.redirect(`${dashboardUrl}/auth/callback?token=${jwt}`);
  });

  // ── Google OAuth ─────────────────────────────────────────────

  app.get("/api/v1/auth/google", async (request, reply) => {
    const state = randomBytes(16).toString("hex");
    return reply.redirect(getGoogleAuthUrl(state));
  });

  app.get("/api/v1/auth/google/callback", async (request, reply) => {
    const { code } = request.query as { code: string };
    if (!code) return reply.status(400).send({ error: "Missing code" });

    const accessToken = await exchangeGoogleCode(code);
    const gUser = await getGoogleUser(accessToken);

    // Upsert user
    let [user] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.googleId, gUser.googleId),
          eq(users.email, gUser.email)
        )
      )
      .limit(1);

    if (user) {
      [user] = await db
        .update(users)
        .set({
          googleId: gUser.googleId,
          name: gUser.name,
          avatarUrl: gUser.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
    } else {
      [user] = await db
        .insert(users)
        .values({
          email: gUser.email,
          name: gUser.name,
          avatarUrl: gUser.avatarUrl,
          googleId: gUser.googleId,
          role: "student",
        })
        .returning();
    }

    const jwt = signJwt({ sub: user.id, email: user.email, role: user.role });
    const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:5173";
    return reply.redirect(`${dashboardUrl}/auth/callback?token=${jwt}`);
  });

  // ── Current User ─────────────────────────────────────────────

  app.get(
    "/api/v1/auth/me",
    { preHandler: [authMiddleware] },
    async (request) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);
      if (!user) return { error: "User not found" };
      const { githubAccessTokenEnc, ...safeUser } = user;
      return safeUser;
    }
  );

  // ── PAT Management ───────────────────────────────────────────

  app.post(
    "/api/v1/auth/tokens",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const body = createPatSchema.parse(request.body);
      const { token, hash } = generatePat();

      const expiresAt = body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 86400000)
        : undefined;

      const [pat] = await db
        .insert(personalAccessTokens)
        .values({
          userId: request.userId,
          name: body.name,
          tokenHash: hash,
          expiresAt,
        })
        .returning();

      // Only return the raw token once
      return reply.status(201).send({
        id: pat.id,
        name: pat.name,
        token,
        expiresAt: pat.expiresAt,
        createdAt: pat.createdAt,
      });
    }
  );

  app.get(
    "/api/v1/auth/tokens",
    { preHandler: [authMiddleware] },
    async (request) => {
      return db
        .select({
          id: personalAccessTokens.id,
          name: personalAccessTokens.name,
          lastUsedAt: personalAccessTokens.lastUsedAt,
          expiresAt: personalAccessTokens.expiresAt,
          createdAt: personalAccessTokens.createdAt,
        })
        .from(personalAccessTokens)
        .where(eq(personalAccessTokens.userId, request.userId));
    }
  );

  app.delete(
    "/api/v1/auth/tokens/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await db
        .delete(personalAccessTokens)
        .where(eq(personalAccessTokens.id, id));
      return reply.status(204).send();
    }
  );

  // ── Token validation (for MCP server) ────────────────────────

  app.get(
    "/api/v1/auth/validate",
    { preHandler: [authMiddleware] },
    async (request) => {
      return { id: request.userId, email: request.userEmail, role: request.userRole };
    }
  );
}
