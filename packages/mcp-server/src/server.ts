import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "./apiClient.js";
import { initAuth } from "./auth.js";
import { memoryReadSchema, memoryRead } from "./tools/memoryRead.js";
import { memoryWriteSchema, memoryWrite } from "./tools/memoryWrite.js";
import { memorySearchSchema, memorySearch } from "./tools/memorySearch.js";
import { memoryDeleteSchema, memoryDelete } from "./tools/memoryDelete.js";
import { sessionStartSchema, sessionStart } from "./tools/sessionStart.js";
import { sessionLogSchema, sessionLog } from "./tools/sessionLog.js";
import { sessionEndSchema, sessionEnd } from "./tools/sessionEnd.js";
import { sharedRead } from "./tools/sharedRead.js";
import { projectContext } from "./tools/projectContext.js";

export async function createServer() {
  const apiUrl = process.env.MEMAI_API_URL || "http://localhost:3000";
  const token = process.env.MEMAI_TOKEN;

  if (!token) {
    throw new Error("MEMAI_TOKEN environment variable is required");
  }

  const apiClient = new ApiClient(apiUrl, token);

  // Validate token and resolve user on startup
  await initAuth(apiClient);

  const server = new McpServer({
    name: "memai",
    version: "0.1.0",
  });

  // ── Memory Tools ────────────────────────────────────────────

  server.tool("memory_read", "Read memories from the project", memoryReadSchema, async (params) => {
    return memoryRead(apiClient, params);
  });

  server.tool("memory_write", "Write a new memory to the project", memoryWriteSchema, async (params) => {
    return memoryWrite(apiClient, params);
  });

  server.tool("memory_search", "Search memories by text query", memorySearchSchema, async (params) => {
    return memorySearch(apiClient, params);
  });

  server.tool("memory_delete", "Delete a memory", memoryDeleteSchema, async (params) => {
    return memoryDelete(apiClient, params);
  });

  // ── Session Tools ───────────────────────────────────────────

  server.tool("session_start", "Start a new agent session", sessionStartSchema, async (params) => {
    return sessionStart(apiClient, params);
  });

  server.tool("session_log", "Log an event to an active session", sessionLogSchema, async (params) => {
    return sessionLog(apiClient, params);
  });

  server.tool("session_end", "End an active session", sessionEndSchema, async (params) => {
    return sessionEnd(apiClient, params);
  });

  // ── Sharing & Context Tools ─────────────────────────────────

  server.tool("shared_read", "Read memories shared with you", {}, async () => {
    return sharedRead(apiClient);
  });

  server.tool("project_context", "Get project overview and stats", {}, async () => {
    return projectContext(apiClient);
  });

  return server;
}
