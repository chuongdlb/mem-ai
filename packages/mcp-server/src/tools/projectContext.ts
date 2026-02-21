import { z } from "zod";
import type { ApiClient } from "../apiClient.js";
import { getProjectId } from "../auth.js";

export const projectContextSchema = {};

export async function projectContext(apiClient: ApiClient) {
  const project = await apiClient.getProject(getProjectId());

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            id: project.id,
            name: project.name,
            description: project.description,
            group: project.group?.name,
            memoriesCount: project.memories?.length || 0,
            sessionsCount: project.sessions?.length || 0,
          },
          null,
          2
        ),
      },
    ],
  };
}
