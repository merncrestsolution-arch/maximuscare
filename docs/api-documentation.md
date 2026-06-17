# Maximus Care — API Documentation

**Base URL:** `/api`  
**Auth:** Bearer token (`Authorization: Bearer <accessToken>`)  
**Content-Type:** `application/json`

---

## Authentication

### POST `/api/auth/login`
Login with email and password.

**Body:** `{ "email": string, "password": string }`  
**Response:** `{ accessToken, refreshToken, expiresIn, user }`  
**Rate limit:** 10 requests / 15 min

### POST `/api/auth/refresh`
Refresh access token.

**Body:** `{ "refreshToken": string }`  
**Response:** `{ accessToken, expiresIn }`

### GET `/api/auth/me`
Current user + branch context.

**Response:**
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "role": "Admin",
  "selectedBranchId": "uuid | null",
  "selectedBranchName": "string | null",
  "allowedBranches": [{ "id", "name", "branchName", "code" }],
  "requiresBranchSelection": false
}
```

### POST `/api/auth/select-branch`
Select active branch for session.

**Body:** `{ "branchId": "uuid" }`  
**Permission:** Authenticated  
**Response:** Updated branch context

### GET `/api/auth/branches`
List branches available to current user.

### POST `/api/auth/logout`
Invalidate current session.

### POST `/api/auth/logout-all`
Invalidate all sessions for user.

### POST `/api/auth/change-password`
**Body:** `{ "currentPassword", "newPassword" }`

### POST `/api/auth/forgot-password` / `/api/auth/reset-password`
Password recovery flow (requires Part 8 tables).

---

## Health

### GET `/api/health`
**Response:** `{ "status": "ok", "timestamp": "ISO8601" }`

---

## Staff

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/staff` | Auth | List staff (management sees all) |
| GET | `/api/staff/:id` | Auth | Staff profile |
| POST | `/api/staff` | `staff.manage` | Create staff |
| PATCH | `/api/staff/:id` | Auth (self or manage) | Update staff |
| PATCH | `/api/staff/:id/password` | Auth (self or manage) | Change password |
| DELETE | `/api/staff/:id` | `staff.manage` | Soft delete |

---

## Patients

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/patients` | Auth + branch | List patients (branch-filtered) |
| GET | `/api/patients/:id` | Auth | Patient detail |
| POST | `/api/patients` | `patients.manage` | Create (auto `PAT000001` code) |
| PATCH | `/api/patients/:id` | `patients.manage` | Update |
| DELETE | `/api/patients/:id` | `critical.delete` | Soft delete |
| GET | `/api/patients/export` | Admin/MD/Receptionist | Export dataset |
| GET | `/api/patients/dashboard` | Auth | Patient KPIs |
| GET | `/api/patients/:id/stats` | Auth | Patient visit stats |
| GET/POST | `/api/patients/:id/documents` | Auth | Document CRUD |
| POST | `/api/patients/:id/documents/upload` | Auth | File upload |
| GET/POST | `/api/patients/:id/notes` | Auth | Clinical notes |

**Query params (list):** `search`, `status`, `branch`, `page`, `limit`

---

## Visits

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/visits` | Auth + branch | List visits |
| GET | `/api/visits/unpaid` | Auth | Unpaid visits |
| GET | `/api/visits/:id` | Auth | Visit detail |
| POST | `/api/visits` | visits.manage roles | Create visit |
| PATCH | `/api/visits/:id` | visits.manage roles | Update visit |
| DELETE | `/api/visits/:id` | Admin | Soft delete |
| GET | `/api/visits/:id/payments` | Auth | Payment history |
| POST | `/api/visits/:id/payments` | Admin/MD/Receptionist | Record payment |

---

## Home Visits

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/home-visits` | List home visits |
| POST | `/api/home-visits` | Create |
| PATCH | `/api/home-visits/:id` | Update |
| DELETE | `/api/home-visits/:id` | Admin/MD delete |

---

## Attendance

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/attendance` | List with date filters |
| POST | `/api/attendance` | Mark attendance |
| PATCH | `/api/attendance/:id` | Update record |
| DELETE | `/api/attendance/:id` | Admin delete |

**Statuses:** `Present`, `Absent`, `Leave`, `Holiday`

---

## Salary & Payroll

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/salary/preview` | `salary.manage` | Preview calculation |
| POST | `/api/salary/generate` | `salary.manage` | Generate monthly salaries |
| GET | `/api/salary` | Auth | List salary records |
| PATCH | `/api/salary/:id/approve` | `salary.approve` | Approve |
| PATCH | `/api/salary/:id/pay` | `salary.manage` | Mark paid |
| GET | `/api/payroll/report` | Auth | Payroll report |
| POST/GET | `/api/payroll/snapshots` | Admin/MD | Immutable snapshots |

**Salary formula** (via `calculationEngine.ts`):
```
finalSalary = basicSalary + incentive + homeVisits + OT - fines - extraHolidayDeduction - otherDeductions
```

---

## Reports

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/reports/dashboard-kpis` | Auth + branch | Branch dashboard KPIs |
| GET | `/api/reports/branch-stats` | `reports.view` | Per-branch statistics |
| GET | `/api/reports/revenue` | `reports.view` | Revenue report |
| GET | `/api/reports/incentive` | Auth | Incentive report |
| GET | `/api/reports/attendance` | Auth | Attendance report |
| GET | `/api/reports/expenses` | Admin/MD | Expense report |
| GET | `/api/reports/unpaid` | Auth | Unpaid visits |
| GET | `/api/reports/sessions` | Auth | Session report |
| GET | `/api/reports/staff/:staffId` | Auth | Staff performance |
| GET | `/api/reports/therapist-patients` | Admin/MD | Therapist-patient summary |

**Common query params:** `from`, `to`, `branch`, `staffId`

---

## Branches & Settings

| Method | Path | Permission |
|--------|------|------------|
| GET/POST/PATCH/DELETE | `/api/branches` | `branches.manage` |
| GET/PUT | `/api/clinic-settings` | `settings.manage` |

---

## Tasks & Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PATCH/DELETE | `/api/tasks` | Task CRUD |
| GET | `/api/notifications` | User notifications |
| GET | `/api/notifications/unread-count` | Unread count |
| PATCH | `/api/notifications/:id/read` | Mark read |
| POST | `/api/notifications/mark-all-read` | Mark all read |

---

## Audit

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/audit-logs` | `audit.view` |

**Query params:** `module`, `action`, `from`, `to`, `page`, `limit`

---

## Error Responses

| Code | Meaning |
|------|---------|
| 400 | Validation error — `{ message, errors? }` |
| 401 | Unauthorized — missing/invalid token |
| 403 | Forbidden — missing permission or branch |
| 404 | Resource not found |
| 429 | Rate limited |
| 500 | Internal server error |

**Branch errors:**
```json
{ "message": "Branch selection required", "code": "BRANCH_REQUIRED", "allowedBranches": [] }
```

---

## WebSocket (Realtime)

**Endpoint:** `ws://host/ws?token=<accessToken>`  
**Events:** `notification`, `task_update` (partial implementation)

---

*OpenAPI/Swagger generation planned for Phase 15.*
