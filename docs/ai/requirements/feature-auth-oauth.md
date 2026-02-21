---
phase: requirements
title: Authentication & OAuth — Requirements
description: Requirements for OAuth-based dashboard login and PAT-based MCP server authentication
---

# Authentication & OAuth — Requirements

## Problem Statement

MemAI serves two distinct client types with different authentication needs: the React dashboard (used by students and admins via browsers) and MCP servers (used by AI agent CLIs like Claude Code and Gemini CLI running headlessly). The dashboard needs OAuth-based login for a smooth user experience, while MCP servers need long-lived tokens that can be configured as environment variables. Both must resolve to the same user identity and enforce the same authorization model.

**Who is affected?**
- **Students**: Log in via GitHub or Google OAuth through the dashboard; generate Personal Access Tokens (PATs) for their MCP server configurations
- **Admins**: Same login flow as students, with role-based access to admin endpoints
- **MCP servers**: Authenticate via PAT on every API call; need a stable token that doesn't expire frequently
- **System**: Must securely issue, validate, and manage two token types (JWT and PAT) through a unified auth middleware

**Current workarounds**: None. Without auth, all API endpoints would be publicly accessible.

## Goals & Objectives

### Primary Goals
1. **GitHub OAuth login** with access token storage (encrypted) for repo integration features
2. **Google OAuth login** as an alternative for users without GitHub accounts
3. **JWT issuance** on successful OAuth callback for stateless dashboard authentication
4. **Personal Access Token (PAT) management** — create, list, delete, with optional expiration — for MCP server auth
5. **Unified auth middleware** that accepts both JWTs and PATs via the same `Authorization: Bearer <token>` header

### Secondary Goals
6. **Token validation endpoint** (`GET /api/v1/auth/validate`) for MCP servers to verify their token and resolve user identity on startup
7. **User upsert on login** — merge accounts when the same email appears across GitHub and Google providers
8. **Last-used tracking** for PATs to give users visibility into token activity

### Non-Goals
- **CSRF state verification**: The OAuth state parameter is generated (`randomBytes(16)`) but not stored or verified on callback. This is a known gap documented for future hardening.
- **JWT refresh tokens**: JWTs expire after 7 days with no refresh mechanism. Users must re-authenticate via OAuth after expiry.
- **Session revocation**: There is no server-side session store. JWTs cannot be revoked before expiry. PATs can be deleted but active JWTs derived from the same user remain valid.
- **Multi-factor authentication**: Not in scope for the academic use case.
- **OAuth scope consent screen**: Users are not shown a granular consent flow beyond what GitHub/Google provide natively.

## User Stories & Use Cases

### Student
- As a student, I want to **log in with my GitHub account** so that my GitHub access token is also available for repo integration features.
- As a student, I want to **log in with my Google account** as an alternative if I don't want to use GitHub OAuth.
- As a student, I want to **create a PAT with a descriptive name** so I can configure it as `MEMAI_TOKEN` in my MCP server setup.
- As a student, I want to **set an optional expiration** on my PAT (in days) so I can enforce token rotation.
- As a student, I want to **list my PATs** to see which ones exist and when they were last used.
- As a student, I want to **delete a PAT** when I no longer need it or suspect it was compromised.
- As a student, I want to **see my profile info** via `GET /api/v1/auth/me` without my encrypted GitHub token being exposed in the response.

### MCP Server
- As an MCP server, I want to **validate my PAT on startup** via `GET /api/v1/auth/validate` to confirm it's valid and resolve my user ID and role.
- As an MCP server, I want to **send my PAT as a Bearer token** in the Authorization header, using the same format as JWTs, so the API handles both transparently.

### Admin
- As an admin, I want the **same login flow** as students, with my `role` field set to `admin` in the JWT payload for role-based route guards.

### System
- As the auth middleware, I **try JWT verification first** (synchronous, no DB call), and **fall back to PAT lookup** (hashed comparison, DB query) only if JWT verification fails.
- As the OAuth callback handler, I **upsert the user** — matching by provider ID or email — so that returning users update their profile and new users are created with the `student` role.

## Success Criteria

| Criterion | Target |
|---|---|
| GitHub OAuth flow completes | Redirects through GitHub, exchanges code for token, upserts user, issues JWT, redirects to dashboard with `?token=` |
| Google OAuth flow completes | Same pattern as GitHub but via Google's OAuth2 endpoints; no GitHub token stored |
| JWT contains required claims | `sub` (user ID), `email`, `role`; signed with HS256; expires in 7 days |
| PAT format | `memai_` prefix + 32 random bytes (hex); raw token returned only once on creation |
| PAT stored securely | SHA-256 hash of the full token stored in `token_hash` column; raw token never persisted |
| Auth middleware priority | JWT verified first (sync); PAT fallback only on JWT failure; 401 if both fail |
| PAT expiration enforced | Expired PATs (`expiresAt < now`) return 401 even if the hash matches |
| PAT last-used tracking | `lastUsedAt` updated on every successful PAT authentication |
| Sensitive data excluded from `/me` | `githubAccessTokenEnc` field stripped from the response |
| GitHub token encrypted | AES-256-GCM encryption before storage; decrypted only when needed for GitHub API calls |

## Constraints & Assumptions

### Business Constraints
- **Academic context**: The system serves thesis students and supervisors. Enterprise-grade features (SSO, SAML, MFA) are not required.
- **No paid auth service**: Authentication is self-hosted using direct OAuth flows and `jsonwebtoken` for JWT operations. No Auth0, Firebase Auth, or similar dependencies.

### Technical Constraints
- **JWT secret management**: `JWT_SECRET` defaults to `"dev-secret-change-me"` if not set. In production this must be a strong, unique secret. There is no key rotation mechanism; changing the secret invalidates all existing JWTs.
- **No CSRF verification**: OAuth state is generated but not verified on callback. The state parameter is passed to the provider and returned, but the server does not compare it against a stored value. This leaves a theoretical CSRF vector on the OAuth callback endpoint.
- **No JWT refresh**: Tokens expire after 7 days. There is no refresh token flow. Users must complete a full OAuth redirect to get a new JWT. For the dashboard (where users are browser-based), this is a minor friction. For PAT-based MCP servers, this doesn't apply since PATs have independent expiration.
- **Google OAuth users lack GitHub token**: Users who log in via Google do not have a `githubAccessTokenEnc` value. Any endpoint requiring GitHub API access (repo listing, webhook creation, push-to-repo) will return a 400 error for these users.
- **Email-based account merging**: If a user logs in via GitHub and later via Google with the same email (or vice versa), the accounts are merged by matching on email. This assumes email uniqueness and verified emails from both providers.
- **PAT deletion is hard delete**: Deleting a PAT removes it from the database immediately. There is no soft-delete or grace period. Any MCP server using that token will fail auth on the next request.
- **Single user lookup per PAT auth**: PAT authentication requires two DB queries — one to find the token by hash, and one to look up the user by `userId`. This adds latency compared to JWT (which is stateless).

### Assumptions
- OAuth providers (GitHub, Google) are always reachable from the API server.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are configured in the environment for their respective flows to work.
- The dashboard URL (`DASHBOARD_URL`) is correctly configured so the OAuth callback redirect lands on the right page.
- New users default to the `student` role. Admin promotion is done manually (via direct DB update or a separate admin endpoint).
- GitHub's `user:email` and `repo` scopes are sufficient for all MemAI operations (profile info, email access, repo read/write, webhook management).

## Questions & Open Items

- **CSRF verification**: Should the OAuth state parameter be stored in a short-lived cookie and verified on callback? This is a known gap. The risk is low (the callback only issues a JWT redirect), but it should be addressed for hardening.
- **JWT refresh tokens**: Should a refresh token flow be added to avoid forcing re-login every 7 days? Alternatives include extending the JWT lifetime or using sliding-window refresh.
- **Token revocation**: If a user is deactivated or compromised, there is no way to invalidate their active JWTs. Should a token denylist (checked in middleware) be added?
- **Account linking**: What happens if a user logs in via GitHub (email: alice@uni.edu) and another user later logs in via Google with the same email? Currently the second login merges into the first account. Should there be a confirmation step?
- **GitHub token refresh**: GitHub OAuth tokens don't expire by default, but users can revoke them from GitHub settings. Should the API handle 401 responses from GitHub gracefully and prompt re-authentication?
- **PAT scope restrictions**: Currently, PATs have the same permissions as the user's full account. Should PATs support scoped permissions (e.g., read-only, project-specific)?
