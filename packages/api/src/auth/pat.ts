import { randomBytes, createHash } from "node:crypto";

export function generatePat(): { token: string; hash: string } {
  const token = `memai_${randomBytes(32).toString("hex")}`;
  const hash = hashPat(token);
  return { token, hash };
}

export function hashPat(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
