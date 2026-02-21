const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.API_URL || "http://localhost:3000"}/api/v1/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.API_URL || "http://localhost:3000"}/api/v1/auth/google/callback`,
    }),
  });

  const data = (await res.json()) as GoogleTokenResponse;
  if (!data.access_token) {
    throw new Error("Failed to exchange Google code for token");
  }
  return data.access_token;
}

export async function getGoogleUser(
  accessToken: string
): Promise<{ googleId: string; email: string; name: string; avatarUrl: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const user = (await res.json()) as GoogleUser;

  return {
    googleId: user.sub,
    email: user.email,
    name: user.name,
    avatarUrl: user.picture,
  };
}
