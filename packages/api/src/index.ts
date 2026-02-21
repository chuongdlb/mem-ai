import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { groupRoutes } from "./routes/groups.js";
import { projectRoutes } from "./routes/projects.js";
import { memoryRoutes } from "./routes/memories.js";
import { sessionRoutes } from "./routes/sessions.js";
import { repoRoutes } from "./routes/repos.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { exportRoutes } from "./routes/export.js";
import { adminRoutes } from "./routes/admin.js";
import { runRetentionCleanup } from "./services/retention.service.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
});

// Plugins
await app.register(cors, {
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// Routes
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(userRoutes);
await app.register(groupRoutes);
await app.register(projectRoutes);
await app.register(memoryRoutes);
await app.register(sessionRoutes);
await app.register(repoRoutes);
await app.register(webhookRoutes);
await app.register(exportRoutes);
await app.register(adminRoutes);

// Global error handler
app.setErrorHandler((error: Error & { statusCode?: number; issues?: unknown[] }, request, reply) => {
  request.log.error(error);

  // Zod validation errors
  if (error.name === "ZodError") {
    return reply.status(400).send({
      error: "Validation error",
      details: error.issues,
    });
  }

  return reply.status(error.statusCode || 500).send({
    error: error.message || "Internal server error",
  });
});

// Start
const port = parseInt(process.env.PORT || "3000");
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info(`Server listening on ${host}:${port}`);

  // Retention cleanup scheduler — run every 24 hours
  const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

  const runCleanup = async () => {
    try {
      await runRetentionCleanup(app.log);
    } catch (err) {
      app.log.error(err, "Retention cleanup failed");
    }
  };

  // Run once on startup after 30s delay to let DB settle
  setTimeout(runCleanup, 30_000);
  // Then repeat every 24 hours
  setInterval(runCleanup, RETENTION_INTERVAL_MS);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
