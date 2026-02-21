import { eq, and } from "drizzle-orm";
import { MEMORY_FILE_PATTERNS } from "@memai/shared";
import { db } from "../db/index.js";
import {
  connectedRepos,
  repoMemoryFiles,
  memories,
} from "../db/schema.js";
import { getFileContent, decryptToken } from "./github.service.js";
import { createMemory, updateMemory } from "./memory.service.js";
import { users } from "../db/schema.js";

// Non-glob patterns only (skip wildcard patterns for now)
const STATIC_PATTERNS = MEMORY_FILE_PATTERNS.filter(
  (p) => !p.path.includes("*")
);

export async function scanRepoForMemoryFiles(repoId: string) {
  const repo = await db.query.connectedRepos.findFirst({
    where: eq(connectedRepos.id, repoId),
  });

  if (!repo) throw new Error("Repo not found");

  // Get user's GitHub token
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, repo.userId))
    .limit(1);

  if (!user?.githubAccessTokenEnc) {
    throw new Error("User has no GitHub access token");
  }

  const accessToken = decryptToken(user.githubAccessTokenEnc);
  const discoveredFiles: Array<{ filePath: string; agentType: string; content: string; sha: string }> = [];

  for (const pattern of STATIC_PATTERNS) {
    const result = await getFileContent(accessToken, repo.owner, repo.name, pattern.path);
    if (result) {
      discoveredFiles.push({
        filePath: pattern.path,
        agentType: pattern.agent,
        content: result.content,
        sha: result.sha,
      });
    }
  }

  // Import discovered files as memories
  for (const file of discoveredFiles) {
    // Check if already tracked (by repoId + filePath)
    const existing = await db.query.repoMemoryFiles.findFirst({
      where: and(
        eq(repoMemoryFiles.repoId, repoId),
        eq(repoMemoryFiles.filePath, file.filePath)
      ),
    });

    if (existing?.fileSha === file.sha) continue; // No change

    let memoryId = existing?.memoryId;

    if (memoryId) {
      // Update existing memory
      await updateMemory(memoryId, repo.userId, {
        content: file.content,
        title: file.filePath,
      }, "repo_sync");
    } else {
      // Create new memory from file
      const projectId = repo.projectId;
      if (!projectId) continue; // Skip if no project linked

      const memory = await createMemory({
        projectId,
        userId: repo.userId,
        title: file.filePath,
        content: file.content,
        category: "context",
        sourceAgent: file.agentType,
      });
      memoryId = memory.id;
    }

    // Upsert repo_memory_file
    await db
      .insert(repoMemoryFiles)
      .values({
        repoId,
        filePath: file.filePath,
        fileSha: file.sha,
        agentType: file.agentType,
        memoryId,
        lastSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [repoMemoryFiles.repoId, repoMemoryFiles.filePath],
        set: {
          fileSha: file.sha,
          memoryId,
          lastSyncedAt: new Date(),
        },
      });
  }

  // Update last synced
  await db
    .update(connectedRepos)
    .set({ lastSyncedAt: new Date() })
    .where(eq(connectedRepos.id, repoId));

  return discoveredFiles;
}

export async function handleWebhookPush(
  repoId: string,
  changedFiles: string[]
) {
  // Filter for memory file patterns
  const memoryFileChanges = changedFiles.filter((filePath) =>
    STATIC_PATTERNS.some((p) => p.path === filePath)
  );

  if (memoryFileChanges.length === 0) return;

  // Re-scan the repo for changed memory files
  await scanRepoForMemoryFiles(repoId);
}
