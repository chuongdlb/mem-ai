import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { connectedRepos } from "../db/schema.js";
import { verifyWebhookSignatureSync } from "../services/github.service.js";
import { handleWebhookPush } from "../services/repo-sync.service.js";

interface GitHubPushPayload {
  ref: string;
  repository: { id: number; full_name: string };
  commits: Array<{
    added: string[];
    modified: string[];
    removed: string[];
  }>;
}

export async function webhookRoutes(app: FastifyInstance) {
  // Add raw body parsing for signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        const json = JSON.parse(body as string);
        // Attach raw body for signature verification
        (req as any).rawBody = body;
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  app.post("/api/v1/webhooks/github", async (request, reply) => {
    const event = request.headers["x-github-event"] as string;
    const signature = request.headers["x-hub-signature-256"] as string;
    const rawBody = (request as any).rawBody as string;

    if (event !== "push") {
      return reply.status(200).send({ message: "Ignored event" });
    }

    const payload = request.body as GitHubPushPayload;

    // Find the connected repo by GitHub repo ID
    const repo = await db.query.connectedRepos.findFirst({
      where: eq(connectedRepos.githubRepoId, payload.repository.id),
    });

    if (!repo) {
      return reply.status(404).send({ error: "Repo not connected" });
    }

    // Verify webhook signature (mandatory)
    if (!signature || !rawBody) {
      return reply.status(401).send({ error: "Missing webhook signature" });
    }

    const valid = verifyWebhookSignatureSync(rawBody, signature, repo.webhookSecret);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    // Collect changed files
    const changedFiles = payload.commits.flatMap((c) => [
      ...c.added,
      ...c.modified,
    ]);

    // Process in background
    handleWebhookPush(repo.id, changedFiles).catch((err) => {
      request.log.error(err, "Webhook processing failed");
    });

    return { message: "Processing" };
  });
}
