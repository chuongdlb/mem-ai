import { z } from "zod";
import type { ApiClient } from "../apiClient.js";

export const sharedReadSchema = {};

export async function sharedRead(apiClient: ApiClient) {
  const memories = await apiClient.getSharedMemories();

  return {
    content: [
      {
        type: "text" as const,
        text: memories.length > 0
          ? JSON.stringify(memories, null, 2)
          : "No shared memories available.",
      },
    ],
  };
}
