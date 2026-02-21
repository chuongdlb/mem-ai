import { z } from "zod";
import type { ApiClient } from "../apiClient.js";
import { getProjectId } from "../auth.js";

export const sessionStartSchema = {
  agentType: z.string().describe("Agent type (claude-code, gemini-cli, cursor, opencode, etc.)"),
  title: z.string().optional().describe("Optional session title"),
};

export async function sessionStart(
  apiClient: ApiClient,
  params: { agentType: string; title?: string }
) {
  const session = await apiClient.createSession({
    projectId: getProjectId(),
    agentType: params.agentType,
    title: params.title,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: `Session started: ${session.id}\nAgent: ${session.agentType}\nUse this session_id for subsequent session_log and session_end calls.`,
      },
    ],
  };
}
