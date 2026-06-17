# Maximus Care — Deployment Guide

## Prerequisites

- Docker & Docker Compose
- Domain name (production)
- PostgreSQL 16+ (included in compose)
- Redis 7+ (included in compose)

## Quick start (Docker)

```bash
cp .env.example .env
# Edit JWT_SECRET and DATABASE_URL passwords

docker compose up --build -d
```

App: http://localhost:5000  
Default login: `admin@maximuscare.com` / `admin123`

## Production checklist

1. Set strong `JWT_SECRET` (32+ random bytes)
2. Use PostgreSQL — not SQLite
3. Set `REDIS_URL` for dashboard cache
4. Put Nginx in front (`deploy/nginx.conf`)
5. Enable HTTPS with Certbot
6. Change default admin passwords
7. Configure daily DB backups
8. Set `NODE_ENV=production`

## Nginx + SSL

1. Copy `deploy/nginx.conf` to `/etc/nginx/sites-available/maximus`
2. Replace `your-domain.com`
3. `sudo ln -s ... sites-enabled/maximus && sudo nginx -t && sudo systemctl reload nginx`
4. `sudo certbot --nginx -d your-domain.com`

## Environment variables

See `.env.example` for full list.

## Backups

```bash
# PostgreSQL dump (daily cron)
docker compose exec postgres pg_dump -U maximus maximus > backup-$(date +%F).sql
```

## Monitoring

- Health: `GET /api/health`
- Logs: `docker compose logs -f app`
- Redis: `docker compose exec redis redis-cli ping`

## CI

GitHub Actions runs `npm run check`, `npm test`, `npm run build` on push.
