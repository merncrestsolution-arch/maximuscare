# Maximus Care — RBAC Permission Matrix

**Source of truth (server):** `server/rbac/permissions.ts`  
**Middleware:** `server/auth.ts` → `requirePermission()`  
**Aliases:** `server/middleware/secureApi.ts`

---

## 1. Roles

| Role | Description |
|------|-------------|
| **Admin** | Full system access including critical deletes and branch management |
| **MD** | Medical Director — clinical + financial management, no critical delete |
| **Receptionist** | Front desk — patients, visits, appointments |
| **Physiotherapist** | Clinical staff — own visits, attendance, salary view |
| **Staff** | General staff — attendance, tasks, own salary |

*Legacy alias: `Physio` → `Physiotherapist`*

---

## 2. Permission Matrix

| Permission | Admin | MD | Receptionist | Physiotherapist | Staff |
|------------|:-----:|:--:|:------------:|:---------------:|:-----:|
| `staff.manage` | ✓ | ✓ | | | |
| `staff.deactivate` | ✓ | ✓ | | | |
| `patients.manage` | ✓ | ✓ | ✓ | | |
| `patients.view_all` | ✓ | ✓ | ✓ | ✓ | |
| `visits.manage` | ✓ | ✓ | ✓ | ✓ | |
| `visits.view_all` | ✓ | ✓ | ✓ | ✓ | |
| `attendance.manage` | ✓ | ✓ | | | |
| `attendance.mark_own` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `tasks.manage` | ✓ | ✓ | | | |
| `tasks.complete_own` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `salary.manage` | ✓ | ✓ | | | |
| `salary.approve` | ✓ | ✓ | | | |
| `salary.view_own` | ✓ | ✓ | | ✓ | ✓ |
| `reports.view` | ✓ | ✓ | | ✓ | |
| `reports.export` | ✓ | ✓ | | | |
| `branches.manage` | ✓ | | | | |
| `settings.manage` | ✓ | | | | |
| `notifications.manage` | ✓ | ✓ | | | |
| `notifications.view_own` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `audit.view` | ✓ | ✓ | | | |
| `critical.delete` | ✓ | | | | |
| `appointments.manage` | ✓ | ✓ | ✓ | | |
| `appointments.view` | ✓ | ✓ | ✓ | ✓ | |

---

## 3. Branch Scoping Rules

| Rule | Behavior |
|------|----------|
| Branch selection | Required after login when staff has access to 2+ branches |
| Data isolation | List endpoints filter by `selected_branch_id` via `branchContext` middleware |
| Admin/MD override | May view all-branch dashboards via `allowAllForManagement` flag |
| Branch access grants | Stored in `user_branch_access`; falls back to `staff.branch` text field |
| Forbidden access | HTTP 403 with `BRANCH_FORBIDDEN` or `BRANCH_REQUIRED` code |

---

## 4. Route Enforcement Status

| Area | Enforcement | Notes |
|------|-------------|-------|
| Patients CRUD | `requirePatientsManage` / `requireCriticalDelete` | ✓ Migrated |
| Staff CRUD | Mixed `requireRole` + permissions | Partial |
| Reports | `requireReportsView` / `requireReportsExport` | ✓ Migrated |
| Salary | `requireSalaryManage` / `requireSalaryApprove` | ✓ Migrated |
| Branches | `requireBranchesManage` | ✓ Migrated |
| Visits | `requireRole` lists | **Needs migration** |
| Attendance | `requireRole` / open | **Needs migration** |
| Appointments | `requireRole` | **Needs migration** |

---

## 5. Client-Side Permission Helpers

`client/src/lib/permissions.ts` provides UI gating (hide nav items, buttons).  
**Rule:** Client checks are UX only — server must always enforce via `requirePermission`.

---

## 6. Planned Enhancements (Phase 12)

1. DB-backed `roles`, `permissions`, `role_permissions` tables for custom roles
2. Per-branch permission overrides (e.g., Receptionist at Branch A only)
3. MFA for Admin/MD
4. PHI access audit on all patient read endpoints

---

*Server implementation: `hasPermission()`, `requirePermission()`, `normalizeRole()` in `server/rbac/permissions.ts`*
