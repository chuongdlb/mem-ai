import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { memoryShares } from "../db/schema.js";

export async function shareMemory(input: {
  memoryId: string;
  sharedWithUserId?: string;
  sharedWithGroupId?: string;
  level?: string;
}) {
  const [share] = await db
    .insert(memoryShares)
    .values({
      memoryId: input.memoryId,
      sharedWithUserId: input.sharedWithUserId,
      sharedWithGroupId: input.sharedWithGroupId,
      level: input.level || "read",
    })
    .returning();

  return share;
}

export async function unshareMemory(shareId: string) {
  await db.delete(memoryShares).where(eq(memoryShares.id, shareId));
}

export async function getMemoryShares(memoryId: string) {
  return db.query.memoryShares.findMany({
    where: eq(memoryShares.memoryId, memoryId),
  });
}
