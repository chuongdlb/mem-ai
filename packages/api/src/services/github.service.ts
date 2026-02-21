import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "0".repeat(64);

// Encrypt GitHub access token for storage
export function encryptToken(token: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(encryptedToken: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const [ivHex, authTagHex, dataHex] = encryptedToken.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data) + decipher.final("utf8");
}

// GitHub API helpers using the user's OAuth token
export async function listUserRepos(accessToken: string) {
  const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json() as Promise<
    Array<{
      id: number;
      name: string;
      full_name: string;
      owner: { login: string };
      default_branch: string;
      private: boolean;
    }>
  >;
}

export async function getFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string
): Promise<{ content: string; sha: string } | null> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

  const data = (await res.json()) as { content: string; sha: string; encoding: string };
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha };
}

export async function createOrUpdateFile(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  existingSha?: string
) {
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content).toString("base64"),
  };
  if (existingSha) body.sha = existingSha;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT file error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function createWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string
): Promise<number> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["push"],
      config: {
        url: webhookUrl,
        content_type: "json",
        secret,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub create webhook error: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: number };
  return data.id;
}

export async function deleteWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  hookId: number
) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`GitHub delete webhook error: ${res.status}`);
  }
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

export function verifyWebhookSignatureSync(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const computed = `sha256=${createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;

  // Constant-time comparison
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
