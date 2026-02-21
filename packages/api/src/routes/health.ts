import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { isOllamaAvailable } from "../services/embedding.service.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/api/v1/health", async () => {
    const checks: Record<string, string> = {};

    // DB check
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    // Ollama check
    checks.ollama = (await isOllamaAvailable()) ? "ok" : "unavailable";

    const healthy = checks.database === "ok";
    return {
      status: healthy ? "healthy" : "unhealthy",
      checks,
      timestamp: new Date().toISOString(),
    };
  });
}
