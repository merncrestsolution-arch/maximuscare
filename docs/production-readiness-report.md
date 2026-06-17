# Maximus Care — Production Readiness Report

**Date:** 2026-06-10  
**Version:** 1.0.0-enterprise-preview  
**Overall readiness:** **68%** — Improved; production deploy after remaining RBAC + performance work

---

## Executive Summary

Maximus Care has a functional clinic management core with centralized business logic, growing multi-branch support, JWT authentication, Docker infrastructure, and 33 automated tests. Critical gaps remain in branch FK enforcement, full RBAC route coverage, production security hardening, background job processing, and comprehensive test coverage before enterprise production deployment.

---

## Readiness Scorecard

| Area | Score | Status |
|------|-------|--------|
| Business logic centralization | 90% | ✅ `calculationEngine.ts` |
| Multi-branch | 65% | 🟡 Selection UI done; FK isolation partial |
| Database schema | 55% | 🟡 Dual SQLite/PG; missing constraints |
| Authentication | 70% | 🟡 JWT + refresh; cookies not HttpOnly |
| Authorization (RBAC) | 72% | 🟡 Appointments + patients routes migrated to requirePermission |
| Reporting | 75% | 🟡 Good coverage; server PDF partial |
| Salary/Incentive engines | 85% | ✅ Formula correct; snapshots exist |
| Patient management | 70% | 🟡 PAT codes; admission workflow partial |
| Attendance | 80% | ✅ Full status support |
| Appointments | 55% | 🟡 Branch-scoped API; reminders via scheduler |
| Tasks/Notifications | 55% | 🟡 Basic; WebSocket partial |
| Security | 55% | 🟡 CSP enabled in production; no MFA yet |
| Performance | 50% | 🟡 Dashboard + revenue reports cached via Redis |
| Mobile UX | 75% | ✅ Responsive pass completed |
| Testing | 45% | 🟡 41 tests; branch + appointment integration tests added |
| Deployment | 65% | 🟡 Docker + CI; no SSL automation |
| Documentation | 80% | ✅ Deliverables generated |

---

## Blockers (Must Fix Before Production)

| # | Blocker | Phase | Effort |
|---|---------|-------|--------|
| 1 | PostgreSQL mandatory; disable SQLite in production | 2 | 3 days |
| 2 | `branch_id` FK backfill + NOT NULL on patients/visits | 2 | 1 week |
| 3 | `UNIQUE(staff_id, salary_month)` constraint | 2 | 1 day |
| 4 | Full `requirePermission` on all routes | 12 | 1 week |
| 5 | HttpOnly secure cookies or hardened token storage | 12 | 1 week |
| 6 | Enable CSP in production helmet config | 12 | 2 days |
| 7 | Dashboard KPI Redis caching | 14 | 3 days |
| 8 | Integration test suite for critical flows | 15 | 2 weeks |
| 9 | Change default admin password + secrets rotation | 16 | 1 day |
| 10 | SSL + Nginx production config | 16 | 2 days |

---

## Phase Completion Status

| Phase | Name | Status | % |
|-------|------|--------|---|
| 1 | System Audit | ✅ Complete | 100% |
| 2 | Database Refactor | 🟡 In progress | 55% |
| 3 | Multi-Branch | 🟡 In progress | 75% |
| 4 | Dashboards | 🟡 Partial | 55% |
| 5 | Enterprise Reporting | 🟡 Partial | 60% |
| 6 | Patient Management | 🟡 Partial | 65% |
| 7 | Attendance | ✅ Mostly complete | 80% |
| 8 | Incentive Engine | ✅ Verified | 90% |
| 9 | Salary Engine | ✅ Mostly complete | 85% |
| 10 | Appointments | 🟡 Branch-scoped | 55% |
| 11 | Tasks | 🟡 Escalation added | 60% |
| 12 | Security | 🟡 CSP + RBAC progress | 55% |
| 13 | Mobile Optimization | ✅ UI audit done | 75% |
| 14 | Performance | 🟡 Redis caching on KPIs/revenue | 50% |
| 15 | Testing | 🟡 41 tests | 45% |
| 16 | Deployment | 🟡 Docker/CI done | 60% |

---

## What's Working Today

- Login → branch selection → dashboard flow
- Four enterprise branches defined in `shared/branches.ts`
- Patient auto-ID: `PAT000001` format
- Incentive: `count = clinicVisits + floor(sessions/2)`; amount if count ≥ 5
- Salary: full formula with immutable payroll snapshots
- Attendance: Present/Absent/Leave/Holiday with OT and auto-fines
- Reports: revenue, incentive, attendance, expenses, unpaid, sessions, staff
- Docker Compose: app + PostgreSQL + Redis + MinIO
- GitHub Actions CI: typecheck + test + build
- 41 passing tests

---

## Stack Alignment Note

The specification targets **Next.js + FastAPI + Celery**. The codebase uses **React/Vite + Express + inline jobs**. Continuing evolution of the current stack is recommended to preserve existing business logic investment. A full stack rewrite is a separate 6–12 month program.

---

## Go-Live Checklist

### Infrastructure
- [ ] Production PostgreSQL with daily backups
- [ ] Redis for dashboard cache
- [ ] Nginx + SSL (Certbot)
- [ ] Strong `JWT_SECRET` (32+ bytes random)
- [ ] MinIO/S3 for document storage
- [ ] Monitoring (Sentry + uptime)

### Application
- [ ] All routes use `requirePermission`
- [ ] Branch isolation on all list endpoints
- [ ] Default passwords changed
- [ ] CSP enabled
- [ ] Rate limits verified

### Quality
- [ ] Integration tests for auth, patients, salary
- [ ] Load test dashboard < 3s
- [ ] Mobile smoke test on iOS + Android
- [ ] Restore drill from backup

### Compliance
- [ ] Audit logging on PHI access
- [ ] Backup encryption
- [ ] Access control documented (RBAC matrix)

---

## Recommendation

**Do not deploy to production** until blockers 1–6 are resolved. Target a **staged rollout** to a single branch (Dehiwala) after Phase 2–4 and 12 completion, with full four-branch rollout after performance validation.

---

## Deliverables Index

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | ER Diagram | `docs/database-erd.md` |
| 2 | Architecture Diagram | `docs/architecture.md` |
| 3 | Database Migrations | `drizzle/migrations/`, `server/migrations/` |
| 4 | API Documentation | `docs/api-documentation.md` |
| 5 | RBAC Matrix | `docs/rbac-matrix.md` |
| 6 | Test Cases | `docs/test-cases.md` |
| 7 | Deployment Guide | `docs/deployment-guide.md` |
| 8 | Backup Strategy | `docs/backup-strategy.md` |
| 9 | Monitoring Strategy | `docs/monitoring-strategy.md` |
| 10 | Production Readiness Report | This document |

---

*Next recommended work: Phase 2 database constraints + Phase 12 RBAC enforcement on remaining routes.*
