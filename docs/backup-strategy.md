# Maximus Care — Backup Strategy

**Environment:** Docker Compose / PostgreSQL 16  
**RPO target:** 24 hours (daily backups)  
**RTO target:** 4 hours

---

## 1. What to Back Up

| Asset | Method | Frequency | Retention |
|-------|--------|-----------|-----------|
| PostgreSQL database | `pg_dump` | Daily 02:00 local | 30 daily, 12 monthly |
| Uploaded files (`/app/data/uploads`) | Volume snapshot / `aws s3 sync` | Daily | 30 days |
| S3/MinIO objects | S3 versioning + cross-region replication | Continuous | 90 days |
| Environment secrets | Encrypted secrets manager (not in repo) | On change | Versioned |
| Redis | Not backed up (cache only) | N/A | N/A |

---

## 2. PostgreSQL Backup Procedure

### Manual backup
```bash
docker compose exec -T postgres pg_dump -U maximus -Fc maximus > backup-$(date +%F).dump
```

### Restore
```bash
docker compose exec -T postgres pg_restore -U maximus -d maximus --clean --if-exists < backup-YYYY-MM-DD.dump
```

### Automated daily cron (host)
```bash
0 2 * * * cd /opt/maximus && docker compose exec -T postgres pg_dump -U maximus -Fc maximus | gzip > /backups/maximus-$(date +\%F).dump.gz
```

---

## 3. File Storage Backup

### Local volume
```bash
docker run --rm -v maximus_uploads:/data -v /backups:/backup alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

### S3 (production)
- Enable bucket versioning
- Lifecycle rule: transition to Glacier after 90 days
- Cross-region replication to secondary region

---

## 4. Backup Verification

| Check | Frequency |
|-------|-----------|
| Restore test to staging DB | Monthly |
| Verify dump file size > 0 | Daily (automated) |
| Verify latest backup age < 25h | Daily (monitoring alert) |

---

## 5. Disaster Recovery Steps

1. Provision new host with Docker
2. Restore latest PostgreSQL dump
3. Restore uploads volume or S3 bucket
4. Deploy app with same `JWT_SECRET` (or force re-login)
5. Verify `/api/health` and login flow
6. Spot-check patient count and latest visit date

---

## 6. Pre-Migration Backups

Before any schema migration (`db:migrate`, `db:migrate-part2`):
```bash
pg_dump -Fc maximus > pre-migration-$(date +%F-%H%M).dump
```

---

## 7. Compliance Notes

- PHI backups must be encrypted at rest (AES-256)
- Backup access limited to Admin role + ops team
- Audit log table included in every dump
- Test restores documented in ops runbook

---

*See `deployment-guide.md` for Docker setup.*
