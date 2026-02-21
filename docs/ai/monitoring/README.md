---
phase: monitoring
title: Monitoring & Observability
description: Define monitoring strategy, metrics, alerts, and incident response
---

# Monitoring & Observability

## Key Metrics

### Performance Metrics
| Metric | Description | Target |
|---|---|---|
| API response latency (p50/p95/p99) | Time from request received to response sent | p50 < 100ms, p95 < 500ms, p99 < 1s |
| Embedding generation latency | Time for Ollama to generate 768-dim vector | < 2s per memory |
| Database query latency | Time for Drizzle queries to execute | < 50ms for simple queries |
| Vector search latency | Time for pgvector similarity search | < 200ms at 10K memories |
| Webhook processing time | Time from webhook receipt to file import completion | < 5s |

### Business Metrics
| Metric | Description | Source |
|---|---|---|
| Total memories per project | Number of stored memories | `memories` table, grouped by `project_id` |
| Active sessions | Currently open sessions (no `ended_at`) | `sessions` table |
| Memories created per day | Daily memory creation rate | `memories.created_at` |
| Sessions per agent type | Usage breakdown by AI CLI | `sessions.agent_type` |
| Connected repos | Number of active repo connections | `connected_repos` where `is_active = true` |
| User count by role | Admin vs student distribution | `users.role` |
| Export count by format | Which agent formats are most used | Audit log with `action = 'export'` |

### Error Metrics
| Metric | Description | Alert Threshold |
|---|---|---|
| API error rate (5xx) | Server errors as % of total requests | > 1% over 5 minutes |
| Auth failure rate | Failed JWT/PAT validations | > 10 failures/minute |
| Webhook processing failures | Failed file imports from GitHub | Any failure |
| Ollama request failures | Failed embedding generation | > 5 failures/minute |
| Database connection errors | Failed Postgres connections | Any failure |

## Monitoring Tools

### Current Stack
| Tool | Purpose | Notes |
|---|---|---|
| **Fastify Pino logger** | Application logging | Structured JSON, configurable log level |
| **Docker healthchecks** | Container health | Built into docker-compose.yml |
| **`GET /api/v1/health`** | Application health endpoint | Checks DB + Ollama connectivity |
| **`audit_logs` table** | Action audit trail | User actions with timestamps and IPs |
| **GitHub Actions logs** | CI/CD pipeline visibility | Build, test, deploy logs |

### Future Considerations
- **Prometheus + Grafana**: Metrics collection and dashboarding (when needed)
- **Loki**: Log aggregation (if Pino JSON logs need centralized search)
- **Uptime monitoring**: External service (UptimeRobot or similar) for `GET /health`

## Logging Strategy

### Log Levels
| Level | Usage | Example |
|---|---|---|
| `error` | Unrecoverable failures, exceptions | DB connection failed, unhandled error |
| `warn` | Recoverable issues, degraded service | Ollama unreachable (fallback to no embedding) |
| `info` | Normal operations, key events | Server started, user authenticated, memory created |
| `debug` | Detailed diagnostic info | Query parameters, response payloads, webhook payloads |

### Configuration
- Log level set via `LOG_LEVEL` env var (default: `info`)
- Production: `info` (to avoid excessive disk usage)
- Development: `debug` (for troubleshooting)

### Structured Logging Format
Fastify's Pino logger outputs structured JSON:
```json
{
  "level": 30,
  "time": 1708000000000,
  "pid": 1,
  "hostname": "api-container",
  "reqId": "req-1",
  "req": { "method": "POST", "url": "/api/v1/memories" },
  "res": { "statusCode": 201 },
  "responseTime": 42.5,
  "msg": "request completed"
}
```

### Log Retention
- Docker container logs: retained by Docker daemon (configure `max-size` and `max-file` in daemon.json)
- Recommended: `max-size: 50m`, `max-file: 5` per container
- Audit logs: retained indefinitely in database (queryable via `/admin/audit`)

### Sensitive Data Handling
- PAT tokens are NEVER logged (only hashes stored in DB)
- GitHub access tokens are NEVER logged (encrypted at rest)
- JWT tokens are not logged in full (only decoded payload for auth middleware)
- Request bodies may be logged at `debug` level — ensure no secrets in request bodies

## Alerts & Notifications

### Critical Alerts
| Condition | Detection | Action |
|---|---|---|
| Database connection failure | Health check returns unhealthy DB status | SSH to VPS, check Postgres container, restart if needed |
| Ollama unreachable | Health check returns unhealthy Ollama status | Check Ollama container, restart, verify model is loaded |
| API container crashed | Docker restart policy triggers | Check logs (`docker compose logs api`), investigate root cause |
| Disk usage > 90% | `df -h` check (manual or cron) | Clean Docker images (`docker system prune`), expand volume |

### Warning Alerts
| Condition | Detection | Action |
|---|---|---|
| API error rate > 1% | Log analysis (grep for 5xx responses) | Review error logs, identify failing endpoint |
| Ollama latency > 5s | Slow embedding generation in logs | Check VPS RAM usage, consider smaller model |
| Webhook signature failures | 401 responses in webhook route logs | Check webhook secret consistency, verify GitHub webhook config |
| Disk usage > 80% | Periodic check | Plan cleanup or volume expansion |

### Alert Delivery
- Currently: Manual monitoring via SSH + log inspection
- Future: External uptime monitor for `/api/v1/health` endpoint with email/Slack alerts

## Dashboards

### System Health Dashboard (via `/admin/stats`)
The admin stats endpoint provides:
- Total user count
- Total group count
- Total project count
- Total memory count
- Total session count

Viewable in the Dashboard UI at `/students` (admin-only page).

### Audit Log Viewer (via `/admin/audit`)
The admin audit endpoint provides:
- Filterable by userId, resourceType
- Paginated with limit/offset
- Shows action, resource, timestamp, IP address

Viewable in the Dashboard UI for admin users.

### Docker Container Dashboard
```bash
# Quick status check
docker compose ps

# Resource usage
docker stats

# Container logs (last 100 lines, follow)
docker compose logs --tail 100 -f api
docker compose logs --tail 100 -f postgres
docker compose logs --tail 100 -f ollama
```

## Incident Response

### On-Call
- Single maintainer for academic project
- Escalation: Check VPS SSH access → Docker logs → database state

### Incident Process

#### 1. Detection and Triage
- Health check failure detected (manual check or external monitor)
- Check `GET /api/v1/health` response
- Classify severity:
  - **P1 (Critical)**: API completely down, database unreachable
  - **P2 (High)**: Major feature broken (auth, memory CRUD)
  - **P3 (Medium)**: Degraded performance, Ollama down (search still works without embeddings)
  - **P4 (Low)**: Non-critical feature issue, cosmetic dashboard bug

#### 2. Investigation and Diagnosis
```bash
# SSH to VPS
ssh deploy@<VPS_HOST>

# Check container status
docker compose ps

# Check container logs
docker compose logs --tail 200 api
docker compose logs --tail 200 postgres
docker compose logs --tail 200 ollama

# Check system resources
free -h          # RAM usage
df -h            # Disk usage
docker stats     # Per-container resources

# Check database connectivity
docker compose exec postgres pg_isready -U memai

# Check Ollama status
docker compose exec ollama curl -s http://localhost:11434/api/tags
```

#### 3. Resolution and Mitigation
| Issue | Resolution |
|---|---|
| API container crashed | `docker compose restart api` |
| Postgres out of connections | Restart Postgres: `docker compose restart postgres`, then API |
| Ollama OOM killed | Restart Ollama: `docker compose restart ollama`, re-pull model |
| Disk full | `docker system prune -f`, remove old images |
| Bad deployment | Rollback: pull previous image SHA, restart (see Deployment docs) |
| Database corruption | Restore from backup: `pg_dump` / `psql` restore |

#### 4. Post-Mortem
- Document what happened, when, and impact
- Root cause analysis
- Action items to prevent recurrence
- Create GitHub issue for any code fixes needed

## Health Checks

### Application Health Endpoint
**`GET /api/v1/health`**

Checks:
1. **Database**: Executes a simple query to verify Postgres connectivity
2. **Ollama**: Calls `GET /api/tags` to verify Ollama is running

Response:
```json
{
  "status": "ok",
  "database": "connected",
  "ollama": "connected",
  "timestamp": "2026-02-20T12:00:00.000Z"
}
```

### Docker Healthchecks
Defined in `docker-compose.yml`:

| Service | Command | Interval | Retries |
|---|---|---|---|
| `postgres` | `pg_isready -U memai` | 5s | 5 |
| `ollama` | `curl -f http://localhost:11434/api/tags` | 10s | — |

The `api` service has `depends_on: postgres (condition: service_healthy)` — it won't start until Postgres is healthy.

### Post-Deploy Smoke Test
The deploy pipeline runs:
```bash
curl -sf http://localhost:3000/api/v1/health
```
If this fails, the deploy is considered unsuccessful (non-zero exit from the SSH script).
