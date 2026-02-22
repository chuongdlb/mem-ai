import jwt from "jsonwebtoken";

const WEAK_SECRETS = ["dev-secret-change-me", "change-this-to-a-random-64-char-string", ""];

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

if (process.env.NODE_ENV === "production" && WEAK_SECRETS.includes(JWT_SECRET)) {
  throw new Error("JWT_SECRET is not set or uses a weak default. Set a strong secret in production.");
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
