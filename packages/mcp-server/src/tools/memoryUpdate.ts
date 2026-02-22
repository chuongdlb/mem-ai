import { z } from "zod";
import type { ApiClient } from "../apiClient.js";

export const memoryUpdateSchema = {
  memoryId: z.string().uuid().describe("ID of the memory to update"),
  title: z.string().min(1).max(500).optional().describe("New title"),
  content: z.string().min(1).optional().describe("New content"),
  category: z.string().optional().describe("New category"),
  tags: z.array(z.string()).optional().describe("New tags"),
};

export async function memoryUpdate(
  apiClient: ApiClient,
  params: { memoryId: string; title?: string; content?: string; category?: string; tags?: string[] }
) {
  const { memoryId, ...updates } = params;
  const memory = await apiClient.updateMemory(memoryId, updates);

  return {
    content: [
      {
        type: "text" as const,
        text: `Memory updated: ${memory.id}\nTitle: ${memory.title}\nVersion: ${memory.version}`,
      },
    ],
  };
}
