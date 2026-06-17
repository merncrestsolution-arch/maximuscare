# Maximus Care — Test Cases

**Framework:** Vitest + Supertest  
**Run:** `npm test`  
**Current status:** 33 tests passing (6 files)

---

## 1. Existing Test Coverage

| File | Tests | Scope |
|------|-------|-------|
| `server/clinicTime.test.ts` | Clinic timezone/date utilities | Unit |
| `server/services/calculationEngine.test.ts` | Incentive, salary, revenue, home visit formulas | Unit |
| `server/services/payrollService.test.ts` | Payroll generation logic | Unit |
| `server/services/jwtService.test.ts` | JWT sign/verify | Unit |
| `server/services/branchService.test.ts` | Branch access resolution | Unit |
| `server/api.integration.test.ts` | Auth + health endpoints | Integration |

---

## 2. Unit Test Cases — Calculation Engine

### Incentive Engine (Phase 8)

| ID | Case | Input | Expected |
|----|------|-------|----------|
| INC-001 | Basic count | 3 clinic visits, 4 IP sessions | count = 3 + floor(4/2) = 5 |
| INC-002 | Below threshold | count = 4 | amount = 0 |
| INC-003 | At threshold | count = 5 | amount = 5 × 100 = 500 |
| INC-004 | Above threshold | count = 8 | amount = 800 |
| INC-005 | Zero sessions | 0 clinic, 0 IP | count = 0, amount = 0 |
| INC-006 | Odd IP sessions | 0 clinic, 5 IP | count = 2 (floor(5/2)) |

### Salary Engine (Phase 9)

| ID | Case | Input | Expected |
|----|------|-------|----------|
| SAL-001 | Full formula | basic=50000, incentive=500, home=2000, OT=1000, fines=200, holiday=0, deductions=300 | final = 53000 |
| SAL-002 | Negative prevention | All zeros | final = 0 |
| SAL-003 | Snapshot immutability | Generate → approve → regenerate | Historical snapshot unchanged |

### Home Visit Classification

| ID | Case | Branch | Attendance | Expected tier |
|----|------|--------|------------|---------------|
| HV-001 | Main branch present | Dehiwala | Present | Colombo rate |
| HV-002 | Bandaragama | Bandaragama | Present | Bandaragama rate |
| HV-003 | Absent day | Any | Absent | Holiday rate |

### Revenue

| ID | Case | Payment status | Expected |
|----|------|----------------|----------|
| REV-001 | Paid visit | Paid | Full amount counted |
| REV-002 | Partial | Partially Paid | amountPaid counted |
| REV-003 | Unpaid | Unpaid | 0 revenue, outstanding balance |

---

## 3. Integration Test Cases — API

### Authentication

| ID | Endpoint | Case | Expected |
|----|----------|------|----------|
| AUTH-001 | POST /api/auth/login | Valid credentials | 200 + tokens |
| AUTH-002 | POST /api/auth/login | Invalid password | 401 |
| AUTH-003 | GET /api/auth/me | No token | 401 |
| AUTH-004 | POST /api/auth/select-branch | Valid branch | 200 |
| AUTH-005 | POST /api/auth/select-branch | Unauthorized branch | 403 |
| AUTH-006 | POST /api/auth/refresh | Valid refresh | New access token |

### Branch Isolation

| ID | Case | Expected |
|----|------|----------|
| BR-001 | Staff with 1 branch | Auto-selected, no picker |
| BR-002 | Staff with 2+ branches | requiresBranchSelection=true |
| BR-003 | GET /api/patients | Returns only selected branch patients |
| BR-004 | Admin all-branch dashboard | Optional unfiltered view |

### Patients

| ID | Case | Expected |
|----|------|----------|
| PAT-001 | Create patient | Auto PAT000001 format |
| PAT-002 | Duplicate phone | 400 error |
| PAT-003 | Soft delete | deletedAt set, excluded from lists |

### Salary Workflow

| ID | Case | Expected |
|----|------|----------|
| PAY-001 | Preview month | Correct breakdown per staff |
| PAY-002 | Generate | Creates salary records |
| PAY-003 | Approve | Status = Approved |
| PAY-004 | Duplicate month | Reject or idempotent |

---

## 4. Security Test Cases (Phase 15 — Planned)

| ID | Case | Expected |
|----|------|----------|
| SEC-001 | RBAC bypass attempt | 403 on forbidden endpoint |
| SEC-002 | Branch ID tampering | 403 BRANCH_FORBIDDEN |
| SEC-003 | SQL injection in search | Sanitized, no error |
| SEC-004 | XSS in patient name | Escaped in response |
| SEC-005 | Rate limit exceeded | 429 |
| SEC-006 | Expired JWT | 401 |
| SEC-007 | PHI access without auth | 401 |

---

## 5. Performance Test Cases (Phase 15 — Planned)

| ID | Endpoint | Target | Load |
|----|----------|--------|------|
| PERF-001 | GET /api/reports/dashboard-kpis | < 3s p95 | 50 concurrent |
| PERF-002 | GET /api/reports/revenue | < 5s p95 | 20 concurrent |
| PERF-003 | POST /api/salary/generate | Async job < 30s | 100 staff |

---

## 6. Mobile Test Cases (Phase 13)

| ID | Device | Viewport | Checks |
|----|--------|----------|--------|
| MOB-001 | iPhone SE | 375px | Drawer nav, 1-col KPIs, no overflow |
| MOB-002 | Samsung A | 360px | Touch targets ≥ 44px |
| MOB-003 | iPad | 768px | Collapsible sidebar, 2-col grids |
| MOB-004 | Desktop | 1280px | Fixed sidebar, 4-col KPIs |

---

## 7. Regression Test Checklist

Run before each release:

- [ ] `npm run check` — TypeScript compiles
- [ ] `npm test` — All unit/integration tests pass
- [ ] `npm run build` — Production build succeeds
- [ ] Login → branch select → dashboard flow
- [ ] Create patient → create visit → collect payment
- [ ] Mark attendance → generate salary preview
- [ ] Export report (Excel/CSV)
- [ ] Docker compose up — health check passes

---

*Add new tests alongside feature work. Target: 80% coverage on `calculationEngine`, `payrollService`, `branchService`, `authService` by Phase 15.*
