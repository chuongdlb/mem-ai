import { z } from "zod";
import type { ApiClient } from "../apiClient.js";
import { getProjectId } from "../auth.js";

export const memoryReadSchema = {
  memoryId: z.string().uuid().optional().describe("Specific memory ID to read"),
  category: z.string().optional().describe("Filter by category (architecture, convention, decision, preference, snippet, context, other)"),
  limit: z.number().int().min(1).max(50).default(10).describe("Max results to return"),
};

export async function memoryRead(
  apiClient: ApiClient,
  params: { memoryId?: string; category?: string; limit?: number }
) {
  if (params.memoryId) {
    const memory = await apiClient.getMemory(params.memoryId);
    return { content: [{ type: "text" as const, text: JSON.stringify(memory, null, 2) }] };
  }

  const memories = await apiClient.listMemories({
    projectId: getProjectId(),
    category: params.category,
    limit: params.limit,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: memories.length > 0
          ? JSON.stringify(memories, null, 2)
          : "No memories found.",
      },
    ],
  };
}
