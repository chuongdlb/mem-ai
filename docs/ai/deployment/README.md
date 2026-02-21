---
phase: deployment
title: Deployment Strategy
description: Define deployment process, infrastructure, and release procedures
---

# Deployment Strategy

## Infrastructure

### Hosting Platform
- **Provider**: Digital Ocean
- **Type**: Single VPS (Droplet), 4GB+ RAM recommended
- **OS**: Ubuntu (Docker-ready)

### Infrastructure Components

```mermaid
graph TD
    subgraph Digital Ocean VPS
        NGINX[nginx reverse proxy] -->|:3000| API[api container]
        NGINX -->|:3001| DASH[dashboard container]
        API --> PG[postgres container<br>pgvector/pgvector:pg16]
        API --> OL[ollama container<br>ollama/ollama]
        PG --> VOL_PG[(pgdata volume)]
        OL --> VOL_OL[(ollama_data volume)]
    end

    INTERNET[Internet] -->|HTTPS :443| NGINX
    GHCR[GitHub Container Registry] -->|docker pull| API
    GHCR -->|docker pull| DASH
```

**4 Docker services** (production `docker-compose.yml`):

| Service | Image | Ports | Healthcheck |
|---|---|---|---|
| `postgres` | `pgvector/pgvector:pg16` | 5432 (internal) | `pg_isready -U memai` (5s interval, 5 retries) |
| `ollama` | `ollama/ollama` | 11434 (internal) | `curl -f http://localhost:11434/api/tags` (10s interval) |
| `api` | `ghcr.io/<repo>/api:latest` | 3000:3000 | — |
| `dashboard` | `ghcr.io/<repo>/dashboard:latest` | 3001:80 | — |

### Volumes
- `pgdata` — PostgreSQL data (persistent across deploys)
- `ollama_data` — Ollama models (persistent, avoids re-downloading)

### Environment Separation

| Environment | Purpose | Config |
|---|---|---|
| **Development** | Local dev | `docker-compose.dev.yml` (Postgres + Ollama only), API/Dashboard via `pnpm dev` |
| **Production** | Single VPS | `docker-compose.yml` (all 4 services), images from GHCR |

No staging environment — academic project with single deployment target.

## Deployment Pipeline

### Build Process

```mermaid
graph LR
    PUSH[Push to main] --> CI[GitHub Actions CI]
    CI --> BUILD[Build & Typecheck<br>pnpm build]
    BUILD --> TEST[Test<br>pgvector service container]
    BUILD --> DOCKER[Docker Build<br>api + dashboard]
    TEST --> DOCKER
    DOCKER --> GHCR[Push to GHCR<br>:sha + :latest tags]
    GHCR --> DEPLOY[GitHub Actions Deploy]
    DEPLOY --> VPS[SSH to VPS<br>Pull + Restart]
```

### CI Pipeline (`.github/workflows/ci.yml`)

**Trigger**: Push to any branch, PR to main
**Concurrency**: Cancel in-progress CI for same ref

**Job 1: Build & Typecheck** (ubuntu-latest)
1. Checkout code
2. Setup pnpm v9 + Node.js 22
3. Install dependencies (`pnpm install`)
4. Build all packages (`pnpm build` via Turborepo)

**Job 2: Test** (ubuntu-latest, depends on Build)
1. Start PostgreSQL service container (`pgvector/pgvector:pg16`, db: `memai_test`)
2. Checkout + install
3. Build shared package
4. Generate migrations (`pnpm db:generate`)
5. Run migrations (`pnpm db:migrate`)
6. Run tests (`pnpm test --if-present`)
   - `DATABASE_URL=postgres://memai:testpassword@localhost:5432/memai_test`
   - `JWT_SECRET=ci-test-secret-do-not-use-in-production`
   - `ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000`

**Job 3: Docker Build** (ubuntu-latest, depends on Build, only on push to main)
- Build matrix: `[api, dashboard]`
1. Setup Docker Buildx
2. Login to GHCR (`ghcr.io`)
3. Generate image tags (`:sha-<commit>` + `:latest`)
4. Build and push images

### Deploy Pipeline (`.github/workflows/deploy.yml`)

**Trigger**: Runs after CI workflow completes successfully on main
**Concurrency**: `deploy-production` (does NOT cancel in-progress)

**Job: Deploy** (if CI succeeded)
1. Checkout code
2. SCP `docker-compose.yml` to VPS
3. SSH into VPS and execute:
   ```bash
   # Login to GHCR
   echo ${{ GHCR_TOKEN }} | docker login ghcr.io -u ${{ GHCR_USER }} --password-stdin

   # Write .env file from GitHub secrets
   cat > .env << EOF
   DB_PASSWORD=${{ secrets.DB_PASSWORD }}
   JWT_SECRET=${{ secrets.JWT_SECRET }}
   ENCRYPTION_KEY=${{ secrets.ENCRYPTION_KEY }}
   GITHUB_CLIENT_ID=${{ secrets.GITHUB_CLIENT_ID }}
   GITHUB_CLIENT_SECRET=${{ secrets.GITHUB_CLIENT_SECRET }}
   GOOGLE_CLIENT_ID=${{ secrets.GOOGLE_CLIENT_ID }}
   GOOGLE_CLIENT_SECRET=${{ secrets.GOOGLE_CLIENT_SECRET }}
   API_URL=${{ secrets.API_URL }}
   DASHBOARD_URL=${{ secrets.DASHBOARD_URL }}
   GHCR_PREFIX=${{ secrets.GHCR_PREFIX }}
   EOF

   # Pull latest images
   docker compose pull api dashboard

   # Restart services
   docker compose up -d --remove-orphans

   # Run database migrations
   docker compose exec -T api node packages/api/dist/db/migrate.js

   # Pull embedding model (idempotent)
   docker compose exec -T ollama ollama pull nomic-embed-text

   # Health check
   curl -sf http://localhost:3000/api/v1/health
   ```

## Environment Configuration

### GitHub Secrets (12 secrets)

| Secret | Description |
|---|---|
| `VPS_HOST` | Digital Ocean VPS IP/hostname |
| `VPS_USER` | SSH username (e.g., `deploy`) |
| `VPS_SSH_KEY` | SSH private key for deployment |
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | JWT signing secret (64+ chars) |
| `ENCRYPTION_KEY` | AES-256 key (64 hex chars) |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `API_URL` | Production API URL (e.g., `https://api.memai.dev`) |
| `DASHBOARD_URL` | Production dashboard URL (e.g., `https://memai.dev`) |

### Development Configuration
```bash
# .env (gitignored, copied from .env.example)
DB_PASSWORD=devpassword
GITHUB_CLIENT_ID=<your-dev-app-id>
GITHUB_CLIENT_SECRET=<your-dev-app-secret>
GOOGLE_CLIENT_ID=<your-dev-google-id>
GOOGLE_CLIENT_SECRET=<your-dev-google-secret>
JWT_SECRET=<random-64-char-string>
ENCRYPTION_KEY=<64-hex-chars>
VITE_API_URL=http://localhost:3000
OLLAMA_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
```

### Production Configuration
- All env vars injected from GitHub secrets via deploy script
- `.env` file written on VPS during deploy (overwritten each time)
- Docker Compose reads `.env` file for variable substitution

## Deployment Steps

### Pre-Deployment Checklist
1. All CI checks pass (build + test + Docker build)
2. Database migration files committed (if schema changed)
3. No breaking API changes without MCP server update

### Deployment Execution
Deployment is fully automated via GitHub Actions on push to main:

1. CI runs build, tests, and Docker image push
2. Deploy workflow triggers on CI success
3. `docker-compose.yml` is copied to VPS
4. `.env` is written from secrets
5. Images are pulled from GHCR
6. Services are restarted with `docker compose up -d --remove-orphans`
7. Migrations run inside the API container
8. Ollama model is pulled (if not already present)
9. Health check confirms API is responding

### Post-Deployment Validation
1. `GET /api/v1/health` returns `{ status: "ok" }` with DB and Ollama checks
2. Dashboard loads at production URL
3. OAuth login flow works with production callback URLs
4. Spot check: create/read a memory via API

### Manual Deployment (Emergency)
```bash
# SSH to VPS
ssh deploy@<VPS_HOST>

# Pull latest images
docker compose pull

# Restart
docker compose up -d --remove-orphans

# Run migrations
docker compose exec -T api node packages/api/dist/db/migrate.js

# Check health
curl -sf http://localhost:3000/api/v1/health
```

## Database Migrations

### Strategy
- **Schema source of truth**: `packages/api/src/db/schema.ts` (Drizzle ORM)
- **Migration generation**: `pnpm db:generate` (Drizzle Kit reads schema, generates SQL migration files)
- **Migration execution**: `pnpm db:migrate` (runs pending migrations in order)
- **CI**: Migrations generated and run against test database
- **Deploy**: Migrations run inside API container after image pull

### Workflow for Schema Changes
1. Modify `packages/api/src/db/schema.ts`
2. Run `pnpm db:generate` to create migration file
3. Review generated SQL
4. Test locally: `pnpm db:migrate`
5. Commit migration files
6. Push to main → CI generates + migrates test DB → deploy runs migration on prod

### Backup Procedures
- PostgreSQL data is in a Docker volume (`pgdata`)
- Backup: `docker compose exec postgres pg_dump -U memai memai > backup.sql`
- Restore: `docker compose exec -T postgres psql -U memai memai < backup.sql`
- Consider automated daily backups via cron

## Secrets Management

### Principles
- No secrets in code or Docker images
- All secrets stored in GitHub Actions secrets
- `.env` file written on VPS during deploy, not committed
- `ENCRYPTION_KEY` must be consistent across deploys (changing it invalidates all encrypted GitHub tokens)

### Key Rotation
- **JWT_SECRET**: Rotate by updating GitHub secret; existing JWTs will expire within 7 days
- **ENCRYPTION_KEY**: Cannot rotate without re-encrypting all GitHub tokens. Plan: decrypt all tokens with old key, re-encrypt with new key, update in DB within a transaction
- **DB_PASSWORD**: Update in GitHub secret + VPS PostgreSQL config simultaneously
- **OAuth secrets**: Regenerate in GitHub/Google developer console, update GitHub secret

## Rollback Plan

### Rollback Triggers
- Health check fails after deployment
- Critical bug discovered in production
- API error rate spikes above 5%
- Dashboard completely broken

### Rollback Steps
1. Identify the last known good commit SHA
2. Pull the previous image tags:
   ```bash
   docker compose pull api:sha-<previous-sha>
   docker compose pull dashboard:sha-<previous-sha>
   ```
3. Update `docker-compose.yml` image tags to point to previous SHA
4. Restart: `docker compose up -d`
5. If migration was destructive: restore from backup (see Backup Procedures)

### Communication
- Post in team channel if rollback is needed
- Document the issue and resolution in a post-mortem
- Create GitHub issue for the root cause
