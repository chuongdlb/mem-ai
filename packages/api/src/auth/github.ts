const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export function getGitHubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.API_URL || "http://localhost:3000"}/api/v1/auth/github/callback`,
    scope: "user:email repo",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGitHubCode(code: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = (await res.json()) as GitHubTokenResponse;
  if (!data.access_token) {
    throw new Error("Failed to exchange GitHub code for token");
  }
  return data.access_token;
}

export async function getGitHubUser(
  accessToken: string
): Promise<{ githubId: string; email: string; name: string; avatarUrl: string; accessToken: string }> {
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  const user = (await userRes.json()) as GitHubUser;
  const emailsData = await emailsRes.json();
  const emails = Array.isArray(emailsData) ? (emailsData as GitHubEmail[]) : [];

  const primaryEmail =
    emails.find((e) => e.primary && e.verified)?.email ||
    user.email ||
    `${user.login}@users.noreply.github.com`;

  return {
    githubId: String(user.id),
    email: primaryEmail,
    name: user.name || user.login,
    avatarUrl: user.avatar_url,
    accessToken,
  };
}
