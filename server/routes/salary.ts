import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { schema } from "../db";
import { requireAuth } from "../auth";
import { requireSalaryManage, requireSalaryApprove } from "../middleware/secureApi";
import { successResponse, errorResponse } from "../response";
import { isManagementRole } from "../permissions";
import { logAudit } from "../services/auditService";
import {
  previewSalary,
  generateSalaryRecord,
  generateSalariesBulk,
  approveSalary,
  rejectSalary,
  returnSalaryForReview,
  markSalaryPaid,
  getSalaryDashboardData,
  getSalaryHistory,
  getSalaryExportRows,
} from "../services/salaryService";
import { loadPayrollSettings } from "../services/payrollService";
import { loadBranchContext } from "../middleware/branchContext";
import { normalizeBranchName } from "@shared/branches";

const {
  insertStaffDeductionSchema,
  updateStaffDeductionSchema,
  insertStaffOtEntrySchema,
  updateStaffOtEntrySchema,
  PAYMENT_METHODS,
} = schema;

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

async function editorName(staffId: string) {
  const s = await storage.getStaff(staffId);
  return s?.name ?? "";
}

export function registerSalaryRoutes(app: Express) {
  // ── Preview ──
  app.get("/api/salary/preview", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const staffId = req.query.staffId as string;
      const periodStart = req.query.periodStart as string;
      const periodEnd = req.query.periodEnd as string;
      if (!staffId || !periodStart || !periodEnd) {
        return errorResponse(res, "staffId, periodStart, periodEnd required", 400);
      }
      const preview = await previewSalary(storage, staffId, periodStart, periodEnd);
      if (!preview) return errorResponse(res, "Staff not found", 404);
      return successResponse(res, preview);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ── Salary detail breakdown (Bug 6) ──
  // Full salary breakdown for the Reports page. Access:
  //   • Staff / Physiotherapist → their OWN report only
  //   • Manager / Branch Manager → any staff in their branch
  //   • Admin / MD / Nexus MD → any staff
  app.get("/api/staff/:id/salary/detail", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const role = String(user.role ?? "").trim();
      const allowedRoles = [
        "Admin",
        "MD",
        "Nexus MD",
        "Manager",
        "Branch Manager",
        "Staff",
        "Physiotherapist",
      ];
      if (!allowedRoles.includes(role)) {
        return errorResponse(res, "Access denied", 403);
      }

      const targetId = param(req, "id");
      // Staff / physiotherapists may only see their own breakdown.
      if ((role === "Staff" || role === "Physiotherapist") && targetId !== user.staffId) {
        return errorResponse(res, "Access denied", 403);
      }

      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return errorResponse(res, "startDate and endDate are required", 400);
      }

      const preview = await previewSalary(storage, targetId, startDate, endDate);
      if (!preview) return errorResponse(res, "Staff not found", 404);

      // Branch leads are scoped to staff within their allowed branches.
      if (role === "Manager" || role === "Branch Manager") {
        const ctx = await loadBranchContext(req as any);
        const allowedNames = new Set(
          (ctx?.allowedBranches ?? []).map((b: any) =>
            normalizeBranchName(b.branchName ?? b.name).toLowerCase()
          )
        );
        const targetBranch = normalizeBranchName(preview.staff.branch ?? "").toLowerCase();
        if (targetBranch && !allowedNames.has(targetBranch)) {
          return errorResponse(res, "Access denied", 403);
        }
      }

      const settings = await loadPayrollSettings(storage);
      const s = preview.summary as any;

      const colomboHolidayCount = Number(s.holidayHomeVisits || 0);
      const colomboHomeTotal = Number(s.colomboHome || 0);
      const colomboRegularCount = Math.max(0, colomboHomeTotal - colomboHolidayCount);
      const otherHomeCount = Number(s.bandaragamaHome || 0);
      const otherAdjustments = Number(s.otherAdjustments || 0);
      const additionsAmount = Number(s.incentiveTotal || 0) + (otherAdjustments > 0 ? otherAdjustments : 0);
      const staffDeductionsTotal = Number(s.staffDeductionsTotal || 0);
      const otherDecrements = staffDeductionsTotal + (otherAdjustments < 0 ? Math.abs(otherAdjustments) : 0);

      const breakdown = {
        staff: {
          id: preview.staff.id,
          name: preview.staff.name,
          role: preview.staff.role,
          branch: preview.staff.branch,
        },
        period: { startDate, endDate },
        basicSalary: Number(s.basicSalary || 0),
        homeVisits: {
          colomboRegular: {
            count: colomboRegularCount,
            rate: settings.homeColombo,
            amount: colomboRegularCount * settings.homeColombo,
          },
          colomboHoliday: {
            count: colomboHolidayCount,
            rate: settings.holidayHome,
            amount: Number(s.holidayHomeIncome || 0),
          },
          otherBranches: {
            count: otherHomeCount,
            rate: settings.homeBandaragama,
            amount: otherHomeCount * settings.homeBandaragama,
          },
          total: Number(s.homeIncome || 0),
        },
        ot: {
          hours: Number(s.totalOt || 0),
          rate: settings.otPerHour,
          amount: Number(s.otIncome || 0),
        },
        additions: {
          incentives: Number(s.incentiveTotal || 0),
          bonuses: otherAdjustments > 0 ? otherAdjustments : 0,
          amount: additionsAmount,
        },
        deductions: {
          fines: { amount: Number(s.finesTotal || 0) },
          extraHolidays: {
            days: Number(s.extraHolidays || 0),
            rate: settings.extraHolidayDeduction,
            amount: Number(s.extraHolidayDeduction || 0),
          },
          other: { amount: otherDecrements },
          total: Number(s.finesTotal || 0) + Number(s.extraHolidayDeduction || 0) + otherDecrements,
        },
        finalSalary: Number(s.finalSalary || 0),
      };

      return successResponse(res, breakdown);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ── Generate ──
  app.post("/api/salary/generate", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const { staffId, staffIds, periodStart, periodEnd, all } = req.body;
      if (!periodStart || !periodEnd) {
        return errorResponse(res, "periodStart and periodEnd required", 400);
      }
      const editor = await editorName(user.staffId);

      if (all) {
        const { enqueueJob } = await import("../jobs/jobQueue");
        const jobId = enqueueJob("salary.generate.all", async () => {
          const result = await generateSalariesBulk(
            storage,
            "all",
            periodStart,
            periodEnd,
            user.staffId,
            editor
          );
          for (const record of result.created) {
            await logAudit(storage, {
              userId: user.staffId,
              userName: editor,
              module: "salary",
              action: "generate",
              recordId: record.id,
              newValue: record,
            });
          }
          return result;
        });
        return successResponse(res, { jobId, status: "queued" }, "Bulk salary generation queued", 202);
      }

      if (staffIds?.length) {
        const result = await generateSalariesBulk(
          storage,
          staffIds,
          periodStart,
          periodEnd,
          user.staffId,
          editor
        );
        for (const record of result.created) {
          await logAudit(storage, {
            userId: user.staffId,
            userName: editor,
            module: "salary",
            action: "generate",
            recordId: record.id,
            newValue: record,
          });
        }
        return successResponse(res, result, "Salary generation complete", 201);
      }

      if (!staffId) return errorResponse(res, "staffId, staffIds, or all required", 400);
      const record = await generateSalaryRecord(
        storage,
        staffId,
        periodStart,
        periodEnd,
        user.staffId,
        editor
      );
      await logAudit(storage, {
        userId: user.staffId,
        userName: editor,
        module: "salary",
        action: "generate",
        recordId: record.id,
        newValue: record,
      });
      return successResponse(res, record, "Salary generated", 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/jobs/:id", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const { getJob } = await import("../jobs/jobQueue");
      const job = getJob(param(req, "id"));
      if (!job) return errorResponse(res, "Job not found", 404);
      return successResponse(res, job);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ── History ──
  app.get("/api/salary/history", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const filters = {
        month: req.query.month as string | undefined,
        year: req.query.year as string | undefined,
        branch: req.query.branch as string | undefined,
        staffId: req.query.staffId as string | undefined,
        status: req.query.status as string | undefined,
      };
      if (!isManagementRole(user.role)) {
        filters.staffId = user.staffId;
      }
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      if (page && limit) {
        const { parsePagination } = await import("../helpers/pagination");
        const { page: p, limit: l } = parsePagination({ page, limit });
        const result = await storage.getSalariesPaginated(filters, p, l);
        return successResponse(res, {
          data: result.data,
          pagination: {
            page: p,
            limit: l,
            total: result.total,
            totalPages: Math.max(1, Math.ceil(result.total / l)),
          },
        });
      }
      const rows = await getSalaryHistory(storage, filters);
      return successResponse(res, rows);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ── Dashboard & export (before :id) ──
  app.get("/api/salary/dashboard", requireAuth, requireSalaryManage, async (_req, res) => {
    try {
      const data = await getSalaryDashboardData(storage);
      return successResponse(res, data);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/salary/export", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const rows = await getSalaryExportRows(storage, {
        month: req.query.month as string | undefined,
        year: req.query.year as string | undefined,
        branch: req.query.branch as string | undefined,
        staffId: req.query.staffId as string | undefined,
        status: req.query.status as string | undefined,
      });
      return successResponse(res, rows);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ── Deductions CRUD ──
  app.get("/api/salary/deductions", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const staffId = req.query.staffId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      if (staffId && startDate && endDate) {
        const rows = await storage.getStaffDeductionsByStaffAndRange(staffId, startDate, endDate);
        return successResponse(res, rows);
      }
      const rows = await storage.getAllStaffDeductions();
      return successResponse(res, rows);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/salary/deductions", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const data = insertStaffDeductionSchema.parse(req.body);
      if (Number(data.amount) < 0) return errorResponse(res, "Amount cannot be negative", 400);
      const staff = await storage.getStaff(data.staffId);
      const record = await storage.createStaffDeduction({
        ...data,
        staffName: staff?.name ?? data.staffId,
        createdByStaffId: user.staffId,
        createdByName: await editorName(user.staffId),
      } as any);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "salary",
        action: "deduction_create",
        recordId: record.id,
        newValue: record,
      });
      return successResponse(res, record, "Deduction created", 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.patch("/api/salary/deductions/:id", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const before = await storage.getAllStaffDeductions().then((rows) => rows.find((r) => r.id === param(req, "id")));
      const data = updateStaffDeductionSchema.parse(req.body);
      if (data.amount != null && Number(data.amount) < 0) return errorResponse(res, "Amount cannot be negative", 400);
      const updated = await storage.updateStaffDeduction(param(req, "id"), data);
      if (!updated) return errorResponse(res, "Not found", 404);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "salary",
        action: "deduction_update",
        recordId: updated.id,
        oldValue: before,
        newValue: updated,
      });
      return successResponse(res, updated);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.delete("/api/salary/deductions/:id", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const ok = await storage.deleteStaffDeduction(param(req, "id"), user.staffId);
      if (!ok) return errorResponse(res, "Not found", 404);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "salary",
        action: "deduction_delete",
        recordId: param(req, "id"),
      });
      return successResponse(res, { deleted: true });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ── OT CRUD ──
  app.get("/api/salary/ot", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const staffId = req.query.staffId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      if (staffId && startDate && endDate) {
        const rows = await storage.getStaffOtEntriesByStaffAndRange(staffId, startDate, endDate);
        return successResponse(res, rows);
      }
      const rows = await storage.getAllStaffOtEntries();
      return successResponse(res, rows);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/salary/ot", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const data = insertStaffOtEntrySchema.parse(req.body);
      if (Number(data.hours) < 0) return errorResponse(res, "OT hours cannot be negative", 400);
      const staff = await storage.getStaff(data.staffId);
      const editor = await editorName(user.staffId);
      const record = await storage.createStaffOtEntry({
        ...data,
        staffName: staff?.name ?? data.staffId,
        approvedByStaffId: user.staffId,
        approvedByName: editor,
      });
      await logAudit(storage, {
        userId: user.staffId,
        userName: editor,
        module: "salary",
        action: "ot_create",
        recordId: record.id,
        newValue: record,
      });
      return successResponse(res, record, "OT entry created", 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.patch("/api/salary/ot/:id", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const data = updateStaffOtEntrySchema.parse(req.body);
      if (data.hours != null && Number(data.hours) < 0) return errorResponse(res, "OT hours cannot be negative", 400);
      const updated = await storage.updateStaffOtEntry(param(req, "id"), data);
      if (!updated) return errorResponse(res, "Not found", 404);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "salary",
        action: "ot_update",
        recordId: updated.id,
        newValue: updated,
      });
      return successResponse(res, updated);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.delete("/api/salary/ot/:id", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const ok = await storage.deleteStaffOtEntry(param(req, "id"), user.staffId);
      if (!ok) return errorResponse(res, "Not found", 404);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "salary",
        action: "ot_delete",
        recordId: param(req, "id"),
      });
      return successResponse(res, { deleted: true });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ── Single record ──
  app.get("/api/salary/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const record = await storage.getSalary(param(req, "id"));
      if (!record) return errorResponse(res, "Not found", 404);
      if (!isManagementRole(user.role) && record.staffId !== user.staffId) {
        return errorResponse(res, "Forbidden", 403);
      }
      return successResponse(res, record);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ── Approval workflow ──
  app.post("/api/salary/:id/approve", requireAuth, requireSalaryApprove, async (req, res) => {
    try {
      const user = (req as any).user;
      const editor = await editorName(user.staffId);
      const before = await storage.getSalary(param(req, "id"));
      const updated = await approveSalary(storage, param(req, "id"), user.staffId, editor);
      await logAudit(storage, {
        userId: user.staffId,
        userName: editor,
        module: "salary",
        action: "approve",
        recordId: updated.id,
        oldValue: before,
        newValue: updated,
      });
      return successResponse(res, updated, "Salary approved");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/salary/:id/reject", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const { reason } = req.body;
      if (!reason) return errorResponse(res, "reason required", 400);
      const before = await storage.getSalary(param(req, "id"));
      const updated = await rejectSalary(storage, param(req, "id"), reason);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "salary",
        action: "reject",
        recordId: updated.id,
        oldValue: before,
        newValue: updated,
      });
      return successResponse(res, updated, "Salary rejected");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/salary/:id/return", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const { reason } = req.body;
      const before = await storage.getSalary(param(req, "id"));
      const updated = await returnSalaryForReview(storage, param(req, "id"), reason || "Returned for review");
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "salary",
        action: "return_for_review",
        recordId: updated.id,
        oldValue: before,
        newValue: updated,
      });
      return successResponse(res, updated, "Salary returned for review");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/salary/:id/pay", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const { paymentMethod, paymentReference, paymentRemarks } = req.body;
      if (!paymentMethod) return errorResponse(res, "paymentMethod required", 400);
      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        return errorResponse(res, "Invalid payment method", 400);
      }
      const before = await storage.getSalary(param(req, "id"));
      const updated = await markSalaryPaid(storage, param(req, "id"), {
        paymentMethod,
        paymentReference,
        paymentRemarks,
        paidByStaffId: user.staffId,
      });
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "salary",
        action: "pay",
        recordId: updated.id,
        oldValue: before,
        newValue: updated,
      });
      return successResponse(res, updated, "Salary marked as paid");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  // ── Fine waive ──
  app.post("/api/salary/fines/:id/waive", requireAuth, requireSalaryManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const before = await storage.getStaffFine(param(req, "id"));
      if (!before) return errorResponse(res, "Not found", 404);
      const updated = await storage.updateStaffFine(param(req, "id"), {
        status: "waived",
        updatedByStaffId: user.staffId,
      } as any);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "fine",
        action: "waive",
        recordId: param(req, "id"),
        oldValue: before,
        newValue: updated,
      });
      return successResponse(res, updated, "Fine waived");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });
}
