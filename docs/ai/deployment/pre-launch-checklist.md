# MemAI Pre-Launch Checklist

Go-live readiness checklist for deploying MemAI to the public internet on a single Digital Ocean VPS.

---

## Phase 1: Pre-Deploy

Complete everything in this section **before** touching the production VPS.

### 1.1 GitHub Secrets & Environment

- [ ] `VPS_HOST` — VPS IP or hostname set
- [ ] `VPS_USER` — SSH user (e.g. `deploy`) set
- [ ] `VPS_SSH_KEY` — SSH private key added
- [ ] `DB_PASSWORD` — Strong, unique password (not `changeme`)
- [ ] `JWT_SECRET` — Cryptographically random, 64+ characters
- [ ] `ENCRYPTION_KEY` — Random 32 bytes hex-encoded (64 hex chars, not all zeros)
- [ ] `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth app created
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth credentials created
- [ ] `API_URL` — Production URL (e.g. `https://api.memai.example.com`)
- [ ] `DASHBOARD_URL` — Production URL (e.g. `https://memai.example.com`)
- [ ] Verify: `CORS_ORIGIN` is set to the exact dashboard URL (NOT left blank / allow-all)

### 1.2 OAuth Provider Configuration

- [ ] GitHub OAuth app → "Authorization callback URL" set to `{API_URL}/api/v1/auth/github/callback`
- [ ] Google OAuth consent screen → "Authorized redirect URIs" includes `{API_URL}/api/v1/auth/google/callback`
- [ ] Both OAuth apps have production domains, not localhost

### 1.3 Security Hardening

- [ ] **CORS locked down**: `CORS_ORIGIN` env var set to dashboard domain only — verify the API rejects requests from other origins
- [ ] **Weak-default rejection**: Confirm API refuses to start if `JWT_SECRET` or `ENCRYPTION_KEY` are weak defaults (the code checks this in production)
- [ ] **Rate limiting**: Global 100 req/min is active — acceptable for launch; document plan to add per-route limits later
- [ ] **Known risk — JWT in URL**: OAuth redirect passes JWT as a query parameter. Accept this risk for launch or fix by moving to httpOnly cookie. Decision: ________________
- [ ] **Firewall**: Only ports 22 (SSH), 80 (HTTP→redirect), 443 (HTTPS) open. Verify with `ufw status` or equivalent
- [ ] **SSH hardened**: Key-only auth (no password), root login disabled

### 1.4 VPS & Infrastructure

- [ ] VPS provisioned (4GB+ RAM, Ubuntu 22.04+)
- [ ] Docker Engine installed
- [ ] Docker Compose v2 installed
- [ ] Domain DNS A record points to VPS IP
- [ ] Subdomain DNS for API (e.g. `api.memai.example.com`) points to same VPS
- [ ] SSL certificates provisioned (Let's Encrypt via certbot)
- [ ] nginx installed and configured as reverse proxy:
  - `memai.example.com` → dashboard container (port 3001)
  - `api.memai.example.com` → API container (port 3000)
  - HTTP → HTTPS redirect on both
  - TLS 1.2+ only, strong ciphers
- [ ] Auto-renewal for SSL certs (`certbot renew --dry-run` succeeds)

### 1.5 Database

- [ ] PostgreSQL container starts cleanly from `docker-compose.yml`
- [ ] pgvector extension available (`CREATE EXTENSION IF NOT EXISTS vector` succeeds)
- [ ] All migrations run without error (`docker compose exec -T api node packages/api/dist/db/migrate.js`)
- [ ] `pgdata` volume is on persistent storage (not ephemeral)
- [ ] Backup cron configured:
  ```bash
  # Example: daily pg_dump at 3 AM UTC
  0 3 * * * docker compose exec -T postgres pg_dump -U memai memai | gzip > /backups/memai-$(date +\%Y\%m\%d).sql.gz
  ```
- [ ] Backup retention: keep at least 7 days of daily backups

### 1.6 Docker Images & CI

- [ ] CI pipeline green on `main` branch (build + test pass)
- [ ] Docker images pushed to GHCR (`ghcr.io/<owner>/mem-ai/api:latest`, `ghcr.io/<owner>/mem-ai/dashboard:latest`)
- [ ] `docker compose pull api dashboard` succeeds on VPS
- [ ] Verify image tags in `docker-compose.yml` match what CI pushed

### 1.7 Embeddings

- [ ] Decide embedding strategy for launch:
  - **Option A**: `EMBEDDING_PROVIDER=ollama` — Ollama container running, `nomic-embed-text` model pulled
  - **Option B**: `EMBEDDING_PROVIDER=openai` — `OPENAI_API_KEY` set in secrets
  - **Option C**: `EMBEDDING_PROVIDER=none` — Launch without vector search, add later
- [ ] If Ollama: verify VPS has enough RAM (model needs ~1GB on top of other services)
- [ ] If Ollama: `docker compose --profile ollama up -d` starts correctly

---

## Phase 2: Deploy & Smoke Test

Run these checks **during the go-live window**, immediately after deployment.

### 2.1 Deployment Execution

- [ ] `docker-compose.yml` uploaded to VPS
- [ ] `.env` file written from GitHub secrets (deploy workflow or manual)
- [ ] `docker compose up -d` — all containers start without errors
- [ ] `docker compose ps` — all services show `healthy` or `running`
- [ ] Migrations run successfully (check logs for errors)

### 2.2 Health & Connectivity

- [ ] `curl https://api.memai.example.com/api/v1/health` returns:
  ```json
  { "status": "healthy", "checks": { "database": "ok" } }
  ```
- [ ] Dashboard loads at `https://memai.example.com` (no white screen, no console errors)
- [ ] HTTP requests redirect to HTTPS (both API and dashboard domains)

### 2.3 Authentication Flows

- [ ] GitHub OAuth: Click "Login with GitHub" → redirected to GitHub → authorized → returned to dashboard → logged in
- [ ] Google OAuth: Click "Login with Google" → redirected to Google → authorized → returned to dashboard → logged in
- [ ] JWT works: Authenticated API calls succeed after login
- [ ] PAT creation: Create a PAT in Settings → token returned → token authenticates API calls
- [ ] PAT in MCP: Configure MCP server with new PAT → `memory_read` tool works

### 2.4 Core Functionality

- [ ] **Memory CRUD**: Create a memory via MCP (`memory_write`) → it appears in dashboard → edit it → delete it
- [ ] **Search**: Create 3+ memories → `memory_search` returns relevant results
- [ ] **Sessions**: `session_start` → `session_log` (a few events) → `session_end` → session visible in dashboard
- [ ] **Export**: Export project memories as `claude-md` format → valid output returned
- [ ] **Groups & Projects**: Create a group → add a project → verify scoping works
- [ ] **Version history**: Update a memory → check versions endpoint shows history

### 2.5 Security Verification

- [ ] **HTTPS enforced**: `curl -I http://api.memai.example.com` returns 301/302 to HTTPS
- [ ] **CORS**: `curl -H "Origin: https://evil.com" https://api.memai.example.com/api/v1/health` — no `Access-Control-Allow-Origin: https://evil.com` header
- [ ] **Rate limiting**: Send 101 requests in under a minute → 429 returned
- [ ] **Auth required**: `curl https://api.memai.example.com/api/v1/memories` without auth → 401
- [ ] **Admin RBAC**: Student user cannot access `/admin/*` endpoints → 403
- [ ] **Ownership**: User A cannot edit/delete User B's memories → 403

### 2.6 Container Health

- [ ] `docker compose logs api --tail 50` — no error stack traces or crash loops
- [ ] `docker compose logs postgres --tail 20` — no connection refused or OOM messages
- [ ] `docker stats --no-stream` — memory usage reasonable (API < 512MB, Postgres < 1GB)

---

## Phase 3: Post-Deploy (First 48 Hours)

Monitor and validate over the first two days of operation.

### 3.1 Availability Monitoring

- [ ] Set up external uptime check on health endpoint (UptimeRobot, Healthchecks.io, or similar)
- [ ] Verify no container restarts: `docker compose ps` shows stable uptime
- [ ] Check disk space: `df -h` — sufficient headroom (>50% free)
- [ ] Check memory: `free -h` — no swap thrashing
- [ ] Review `docker compose logs` daily for unexpected errors

### 3.2 Backup Validation

- [ ] First automated pg_dump completes successfully
- [ ] Backup file is non-empty and reasonable size
- [ ] **Test restore**: Load backup into a separate Postgres instance, verify data integrity
- [ ] Backup files are stored outside the VPS (offsite copy) or at minimum on a separate volume

### 3.3 First Real Users

- [ ] First student creates an account via OAuth
- [ ] First PAT issued and used with MCP server
- [ ] Memories flowing from at least one AI agent → visible in dashboard
- [ ] Student can only see their own group's data (not other groups)

### 3.4 Performance Baseline

Record these values — compare again after 1 week of real usage:

| Metric | Day 1 Value | Day 7 Value |
|--------|-------------|-------------|
| Health endpoint response time | _____ ms | _____ ms |
| Memory search response time (10 memories) | _____ ms | _____ ms |
| Memory search response time (100 memories) | _____ ms | _____ ms |
| API container memory usage | _____ MB | _____ MB |
| Postgres container memory usage | _____ MB | _____ MB |
| Database size on disk | _____ MB | _____ MB |
| Total memories stored | _____ | _____ |

### 3.5 Known Gaps to Address Post-Launch

These items are **not blocking launch** but should be prioritized soon after:

| Gap | Priority | Notes |
|-----|----------|-------|
| HNSW vector index on `memories.embedding` | High | Full sequential scan; add index once >100 memories exist |
| Integration tests (~60 cases) | High | Unit tests pass but API paths untested end-to-end |
| JWT in OAuth redirect URL param | Medium | Move to httpOnly cookie to prevent token leakage in logs/referrer |
| Per-route rate limits | Medium | Auth endpoints, search, and admin should have tighter limits |
| Pagination upper bound validation | Low | Limit param could be set extremely high; add cap |
| nginx config in repo | Low | Currently manual; add to version control for reproducibility |
| Automated VPS provisioning | Low | Document or script the VPS setup steps |

---

## Quick Reference Commands

```bash
# Check all services
docker compose ps

# View logs
docker compose logs -f api
docker compose logs -f postgres

# Health check
curl -s https://api.memai.example.com/api/v1/health | jq

# Resource usage
docker stats --no-stream

# Database backup (manual)
docker compose exec -T postgres pg_dump -U memai memai | gzip > backup-$(date +%Y%m%d).sql.gz

# Restart a single service
docker compose restart api

# Rollback to previous image
docker compose pull api  # after updating image tag
docker compose up -d api

# Check firewall
ufw status verbose

# SSL cert status
certbot certificates
```
