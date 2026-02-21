import { z } from "zod";
import type { ApiClient } from "../apiClient.js";

export const memoryDeleteSchema = {
  memoryId: z.string().uuid().describe("ID of the memory to delete"),
};

export async function memoryDelete(
  apiClient: ApiClient,
  params: { memoryId: string }
) {
  await apiClient.deleteMemory(params.memoryId);

  return {
    content: [
      {
        type: "text" as const,
        text: `Memory ${params.memoryId} deleted.`,
      },
    ],
  };
}
