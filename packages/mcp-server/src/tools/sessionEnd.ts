import { z } from "zod";
import type { ApiClient } from "../apiClient.js";

export const sessionEndSchema = {
  sessionId: z.string().uuid().describe("Session ID to end"),
  summary: z.string().optional().describe("Optional session summary"),
};

export async function sessionEnd(
  apiClient: ApiClient,
  params: { sessionId: string; summary?: string }
) {
  const session = await apiClient.endSession(params.sessionId, params.summary);

  return {
    content: [
      {
        type: "text" as const,
        text: `Session ${params.sessionId} ended.${params.summary ? `\nSummary: ${params.summary}` : ""}`,
      },
    ],
  };
}
