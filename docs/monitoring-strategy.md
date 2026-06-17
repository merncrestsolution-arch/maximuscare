# Maximus Care — Monitoring Strategy

**Phase:** 16 (Deployment)  
**Status:** Baseline implemented; APM planned

---

## 1. Health Checks

| Endpoint | Expected | Use |
|----------|----------|-----|
| `GET /api/health` | `{ "status": "ok" }` | Load balancer, Docker healthcheck |
| PostgreSQL | `pg_isready` | Docker Compose healthcheck |
| Redis | `PING` → `PONG` | Cache availability |

### Docker healthcheck (recommended addition to Dockerfile)
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1
```

---

## 2. Logging

| Layer | Method | Location |
|-------|--------|----------|
| Application | `loggerService.ts` | stdout → Docker logs |
| Access | Express request logging | stdout |
| Audit | `audit_logs` table | PostgreSQL (compliance) |
| Errors | `errorHandler.ts` middleware | stdout + future Sentry |

```bash
docker compose logs -f app --tail=100
```

---

## 3. Metrics to Track

| Metric | Source | Alert threshold |
|--------|--------|-----------------|
| API response time p95 | APM / Nginx logs | > 2s |
| Error rate 5xx | App logs | > 1% over 5 min |
| DB connection pool | pg stats | > 80% utilization |
| Redis hit rate | Redis INFO | < 50% (if caching enabled) |
| Disk usage | Host | > 85% |
| Backup age | Cron job | > 25 hours |
| Failed login rate | Audit logs | > 20/min per IP |

---

## 4. Recommended Tooling

| Tool | Purpose | Priority |
|------|---------|----------|
| **Sentry** | Error tracking + stack traces | P1 |
| **Uptime Kuma / Pingdom** | External uptime monitoring | P1 |
| **Grafana + Prometheus** | Metrics dashboards | P2 |
| **pg_stat_statements** | Slow query analysis | P2 |
| **Loki** | Log aggregation | P3 |

---

## 5. Alerting Rules

| Severity | Condition | Action |
|----------|-----------|--------|
| Critical | `/api/health` down 2 min | Page on-call |
| Critical | PostgreSQL unreachable | Page on-call |
| Warning | p95 latency > 3s for 10 min | Slack notification |
| Warning | Backup failed | Email ops |
| Info | Deploy completed | Slack notification |

---

## 6. Dashboard Panels (Grafana)

1. **Operations:** Request rate, error rate, latency percentiles
2. **Business:** Daily visits, revenue, active patients (from cached KPIs)
3. **Infrastructure:** CPU, memory, disk, DB connections
4. **Security:** Failed logins, 403 rate, rate limit hits

---

## 7. Audit & Compliance Monitoring

- Query `audit_logs` for PHI access patterns
- Weekly report: critical deletes, salary approvals, settings changes
- Retain audit logs minimum 7 years (healthcare compliance baseline)

---

## 8. Implementation Checklist

- [x] Health endpoint
- [x] Structured logging service
- [x] Docker Compose service dependencies
- [ ] Sentry DSN in production `.env`
- [ ] Nginx access log rotation
- [ ] Grafana dashboards
- [ ] Automated backup age alert
- [ ] WebSocket connection monitoring

---

*Health check: `curl -s http://localhost:5000/api/health`*
