import type { ApiClient } from "./apiClient.js";

let cachedUser: { id: string; email: string; role: string } | null = null;
let projectId: string | null = null;

export async function initAuth(apiClient: ApiClient): Promise<void> {
  const token = process.env.MEMAI_TOKEN;
  if (!token) throw new Error("MEMAI_TOKEN environment variable not set");

  const pid = process.env.MEMAI_PROJECT_ID;
  if (!pid) throw new Error("MEMAI_PROJECT_ID environment variable not set");

  // Validate token once against the API
  cachedUser = await apiClient.validateToken();
  projectId = pid;
}

export function getUserId(): string {
  if (!cachedUser) throw new Error("Auth not initialized");
  return cachedUser.id;
}

export function getProjectId(): string {
  if (!projectId) throw new Error("Auth not initialized");
  return projectId;
}
