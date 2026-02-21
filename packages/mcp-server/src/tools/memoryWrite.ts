import { z } from "zod";
import type { ApiClient } from "../apiClient.js";
import { getProjectId } from "../auth.js";

export const memoryWriteSchema = {
  title: z.string().min(1).max(500).describe("Title of the memory"),
  content: z.string().min(1).describe("Content of the memory"),
  category: z.string().default("other").describe("Category: architecture, convention, decision, preference, snippet, context, other"),
  tags: z.array(z.string()).default([]).describe("Tags for organizing memories"),
};

export async function memoryWrite(
  apiClient: ApiClient,
  params: { title: string; content: string; category?: string; tags?: string[] },
  agentType?: string
) {
  const memory = await apiClient.createMemory({
    projectId: getProjectId(),
    title: params.title,
    content: params.content,
    category: params.category || "other",
    sourceAgent: agentType,
    tags: params.tags || [],
  });

  return {
    content: [
      {
        type: "text" as const,
        text: `Memory created: ${memory.id}\nTitle: ${memory.title}\nCategory: ${memory.category}`,
      },
    ],
  };
}
