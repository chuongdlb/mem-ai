import { z } from "zod";
import type { ApiClient } from "../apiClient.js";

export const sessionLogSchema = {
  sessionId: z.string().uuid().describe("Session ID (from session_start)"),
  eventType: z.enum(["message", "tool_call", "file_edit", "decision", "error"]).describe("Type of event"),
  content: z.string().describe("Event content/description"),
  metadata: z.record(z.unknown()).optional().describe("Optional metadata"),
};

export async function sessionLog(
  apiClient: ApiClient,
  params: {
    sessionId: string;
    eventType: string;
    content: string;
    metadata?: Record<string, unknown>;
  }
) {
  const event = await apiClient.addSessionEvent({
    sessionId: params.sessionId,
    eventType: params.eventType,
    content: params.content,
    metadata: params.metadata,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: `Event logged: ${event.id} (${event.eventType})`,
      },
    ],
  };
}
