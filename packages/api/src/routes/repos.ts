import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { connectedRepos, repoMemoryFiles, users } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { connectRepoSchema, pushToRepoSchema } from "@memai/shared";
import {
  listUserRepos,
  decryptToken,
  encryptToken,
  createWebhook,
  deleteWebhook,
  generateWebhookSecret,
  getFileContent,
  createOrUpdateFile,
} from "../services/github.service.js";
import { scanRepoForMemoryFiles } from "../services/repo-sync.service.js";
import * as memoryService from "../services/memory.service.js";

export async function repoRoutes(app: FastifyInstance) {
  // List user's GitHub repos (from GitHub API)
  app.get(
    "/api/v1/repos/available",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);

      if (!user?.githubAccessTokenEnc) {
        return reply.status(400).send({ error: "No GitHub token. Please re-login with GitHub." });
      }

      const token = decryptToken(user.githubAccessTokenEnc);
      const repos = await listUserRepos(token);
      return repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        owner: r.owner.login,
        defaultBranch: r.default_branch,
        private: r.private,
      }));
    }
  );

  // List connected repos
  app.get(
    "/api/v1/repos",
    { preHandler: [authMiddleware] },
    async (request) => {
      return db.query.connectedRepos.findMany({
        where: eq(connectedRepos.userId, request.userId),
        with: { memoryFiles: true },
      });
    }
  );

  // Connect a repo
  app.post(
    "/api/v1/repos/connect",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const body = connectRepoSchema.parse(request.body);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);

      if (!user?.githubAccessTokenEnc) {
        return reply.status(400).send({ error: "No GitHub token" });
      }

      const accessToken = decryptToken(user.githubAccessTokenEnc);
      const webhookSecret = generateWebhookSecret();

      // Register webhook on GitHub
      const apiUrl = process.env.API_URL || "http://localhost:3000";
      let webhookId: number | undefined;
      try {
        webhookId = await createWebhook(
          accessToken,
          body.owner,
          body.name,
          `${apiUrl}/api/v1/webhooks/github`,
          webhookSecret
        );
      } catch (err) {
        // Webhook creation may fail for repos without admin access — continue anyway
        request.log.warn(err, "Failed to create webhook");
      }

      const [repo] = await db
        .insert(connectedRepos)
        .values({
          userId: request.userId,
          githubRepoId: body.githubRepoId,
          owner: body.owner,
          name: body.name,
          fullName: body.fullName,
          defaultBranch: body.defaultBranch,
          webhookId,
          webhookSecret,
          projectId: body.projectId,
        })
        .returning();

      // Scan for memory files
      if (body.projectId) {
        try {
          await scanRepoForMemoryFiles(repo.id);
        } catch (err) {
          request.log.warn(err, "Failed initial scan");
        }
      }

      return reply.status(201).send(repo);
    }
  );

  // Disconnect a repo
  app.delete(
    "/api/v1/repos/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const repo = await db.query.connectedRepos.findFirst({
        where: eq(connectedRepos.id, id),
      });

      if (!repo) return reply.status(404).send({ error: "Repo not found" });

      // Remove webhook from GitHub
      if (repo.webhookId) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, repo.userId))
          .limit(1);

        if (user?.githubAccessTokenEnc) {
          try {
            const token = decryptToken(user.githubAccessTokenEnc);
            await deleteWebhook(token, repo.owner, repo.name, repo.webhookId);
          } catch (err) {
            request.log.warn(err, "Failed to remove webhook");
          }
        }
      }

      await db.delete(connectedRepos).where(eq(connectedRepos.id, id));
      return reply.status(204).send();
    }
  );

  // List tracked files
  app.get(
    "/api/v1/repos/:id/files",
    { preHandler: [authMiddleware] },
    async (request) => {
      const { id } = request.params as { id: string };
      return db.query.repoMemoryFiles.findMany({
        where: eq(repoMemoryFiles.repoId, id),
      });
    }
  );

  // Manual re-scan
  app.post(
    "/api/v1/repos/:id/sync",
    { preHandler: [authMiddleware] },
    async (request) => {
      const { id } = request.params as { id: string };
      const files = await scanRepoForMemoryFiles(id);
      return { synced: files.length, files };
    }
  );

  // Push memory to repo
  app.post(
    "/api/v1/repos/:id/push",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = pushToRepoSchema.parse(request.body);

      const repo = await db.query.connectedRepos.findFirst({
        where: eq(connectedRepos.id, id),
      });
      if (!repo) return reply.status(404).send({ error: "Repo not found" });

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);

      if (!user?.githubAccessTokenEnc) {
        return reply.status(400).send({ error: "No GitHub token" });
      }

      const memory = await memoryService.getMemory(body.memoryId);
      if (!memory) return reply.status(404).send({ error: "Memory not found" });

      const accessToken = decryptToken(user.githubAccessTokenEnc);

      // Check if file exists to get SHA
      const existing = await getFileContent(accessToken, repo.owner, repo.name, body.filePath);

      await createOrUpdateFile(
        accessToken,
        repo.owner,
        repo.name,
        body.filePath,
        memory.content,
        `Update ${body.filePath} via MemAI`,
        existing?.sha
      );

      return { success: true, filePath: body.filePath };
    }
  );
}
