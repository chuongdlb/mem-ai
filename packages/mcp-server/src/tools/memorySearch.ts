import { z } from "zod";
import type { ApiClient } from "../apiClient.js";
import { getProjectId } from "../auth.js";

export const memorySearchSchema = {
  query: z.string().min(1).describe("Search query"),
  category: z.string().optional().describe("Filter by category"),
  limit: z.number().int().min(1).max(50).default(10).describe("Max results"),
};

export async function memorySearch(
  apiClient: ApiClient,
  params: { query: string; category?: string; limit?: number }
) {
  const results = await apiClient.searchMemories({
    query: params.query,
    projectId: getProjectId(),
    category: params.category,
    limit: params.limit,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: results.length > 0
          ? JSON.stringify(results, null, 2)
          : `No memories found matching "${params.query}".`,
      },
    ],
  };
}
