import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { schema } from "../db";
import { requireAuth } from "../auth";
import { requireBranchContext, getBranchFilter } from "../middleware/branchContext";
import {
  requirePatientsManage,
  requireReportsExport,
  requireVisitsManage,
  requireCriticalDelete,
} from "../middleware/secureApi";
import { filterByBranchName } from "../services/branchService";
import { successResponse, errorResponse } from "../response";
import { isManagementRole } from "../permissions";
import { logAudit } from "../services/auditService";
import {
  generatePatientCode,
  assertNoDuplicatePatient,
  getPatientStats,
  getPatientDashboard,
  getPatientsFiltered,
  getPatientExportRows,
} from "../services/patientService";
import { recordVisitPayment, enrichVisitWithBalance } from "../services/visitPaymentService";
import { syncHomeVisitFromVisit, detectHomeVisitType, homeVisitRate } from "../services/homeVisitService";
import {
  parseDataUrl,
  uploadPatientDocument,
  getDocumentReadStream,
  getDocumentSignedUrl,
  validateDocumentMime,
  validateDocumentSize,
} from "../services/fileStorageService";
import { z } from "zod";

const { insertPatientDocumentSchema, insertPatientNoteSchema, insertHomeVisitSchema } = schema;

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

async function editorName(staffId: string) {
  const s = await storage.getStaff(staffId);
  return s?.name ?? "";
}

export function registerPatientRoutes(app: Express) {
  app.get("/api/patients/export", requireAuth, requireBranchContext(), requireReportsExport, async (req, res) => {
    try {
      const branchFilter = getBranchFilter(req as any);
      let rows = await getPatientExportRows(storage);
      if (branchFilter) rows = filterByBranchName(rows, branchFilter);
      return successResponse(res, rows);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/patients/dashboard", requireAuth, async (_req, res) => {
    try {
      const data = await getPatientDashboard(storage);
      return successResponse(res, data);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/patients/:id/stats", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const id = param(req, "id");
      if (!isManagementRole(user.role)) {
        const ids = await storage.getPatientIdsForStaff(user.staffId);
        if (!ids.includes(id)) return errorResponse(res, "Forbidden", 403);
      }
      const stats = await getPatientStats(storage, id);
      return successResponse(res, stats);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/patients/:id/documents", requireAuth, async (req, res) => {
    try {
      const rows = await storage.getPatientDocuments(param(req, "id"));
      return successResponse(res, rows);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  const uploadDocumentSchema = z.object({
    fileName: z.string().min(1),
    documentType: z.string().min(1),
    contentBase64: z.string().min(1),
  });

  app.post("/api/patients/:id/documents/upload", requireAuth, requirePatientsManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const patientId = param(req, "id");
      const patient = await storage.getPatient(patientId);
      if (!patient) return errorResponse(res, "Patient not found", 404);

      const body = uploadDocumentSchema.parse(req.body);
      const parsed = parseDataUrl(body.contentBase64);
      if (!parsed) return errorResponse(res, "Invalid file data", 400);
      if (!validateDocumentMime(parsed.mime)) return errorResponse(res, "File type not allowed", 400);
      if (!validateDocumentSize(parsed.buffer.length)) return errorResponse(res, "File too large (max 10MB)", 400);

      const { storageKey, fileSize } = await uploadPatientDocument(
        patientId,
        body.fileName,
        parsed.buffer,
        parsed.mime,
      );

      const doc = await storage.createPatientDocument({
        patientId,
        fileName: body.fileName,
        documentType: body.documentType,
        fileUri: `/api/patients/documents/__pending__/file`,
        storageKey,
        mimeType: parsed.mime,
        fileSize,
        uploadedByStaffId: user.staffId,
        uploadedByName: await editorName(user.staffId),
      } as any);

      await storage.updatePatientDocumentUri(doc.id, `/api/patients/documents/${doc.id}/file`);

      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "patient",
        action: "document_upload",
        recordId: doc.id,
        newValue: { id: doc.id, fileName: body.fileName },
      });
      const saved = await storage.getPatientDocument(doc.id);
      return successResponse(res, saved, "Document uploaded", 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/patients/documents/:id/file", requireAuth, async (req, res) => {
    try {
      const doc = await storage.getPatientDocument(param(req, "id"));
      if (!doc) return errorResponse(res, "Not found", 404);

      if (doc.storageKey) {
        const signed = await getDocumentSignedUrl(doc.storageKey);
        if (signed) return res.redirect(signed);
        const { body, mimeType } = await getDocumentReadStream(doc.storageKey);
        res.setHeader("Content-Type", doc.mimeType || mimeType);
        res.setHeader("Content-Disposition", `inline; filename="${doc.fileName}"`);
        return res.send(body);
      }

      if (doc.fileUri?.startsWith("data:")) {
        const parsed = parseDataUrl(doc.fileUri);
        if (!parsed) return errorResponse(res, "Invalid file", 400);
        res.setHeader("Content-Type", parsed.mime);
        return res.send(parsed.buffer);
      }

      return errorResponse(res, "File not available", 404);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/patients/:id/documents", requireAuth, requirePatientsManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const data = insertPatientDocumentSchema.parse({ ...req.body, patientId: param(req, "id") });
      const doc = await storage.createPatientDocument({
        ...data,
        uploadedByStaffId: user.staffId,
        uploadedByName: await editorName(user.staffId),
      } as any);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "patient",
        action: "document_upload",
        recordId: doc.id,
        newValue: doc,
      });
      return successResponse(res, doc, "Document uploaded", 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.delete("/api/patients/documents/:id", requireAuth, requireCriticalDelete, async (req, res) => {
    try {
      const ok = await storage.deletePatientDocument(param(req, "id"));
      if (!ok) return errorResponse(res, "Not found", 404);
      return successResponse(res, { deleted: true });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/patients/:id/notes", requireAuth, async (req, res) => {
    try {
      const rows = await storage.getPatientNotes(param(req, "id"));
      return successResponse(res, rows);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/patients/:id/notes", requireAuth, requirePatientsManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const data = insertPatientNoteSchema.parse({ ...req.body, patientId: param(req, "id") });
      const note = await storage.createPatientNote({
        ...data,
        createdByStaffId: user.staffId,
        createdByName: await editorName(user.staffId),
      } as any);
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "patient",
        action: "note_create",
        recordId: note.id,
        newValue: note,
      });
      return successResponse(res, note, "Note created", 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.delete("/api/patients/notes/:id", requireAuth, requirePatientsManage, async (req, res) => {
    try {
      const ok = await storage.deletePatientNote(param(req, "id"));
      if (!ok) return errorResponse(res, "Not found", 404);
      return successResponse(res, { deleted: true });
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/visits/:id/payments", requireAuth, async (req, res) => {
    try {
      const rows = await storage.getVisitPaymentsByVisit(param(req, "id"));
      return successResponse(res, rows);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/visits/:id/payments", requireAuth, requirePatientsManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const { amount, paymentMethod, paymentReference, paymentDate, remarks } = req.body;
      if (!amount || !paymentMethod || !paymentDate) {
        return errorResponse(res, "amount, paymentMethod, paymentDate required", 400);
      }
      const result = await recordVisitPayment(storage, param(req, "id"), {
        amount,
        paymentMethod,
        paymentReference,
        paymentDate,
        remarks,
        createdByStaffId: user.staffId,
        createdByName: await editorName(user.staffId),
      });
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "visit",
        action: "payment",
        recordId: result.payment.id,
        newValue: result,
      });
      return successResponse(res, enrichVisitWithBalance(result.visit), "Payment recorded", 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.get("/api/home-visits", requireAuth, async (req, res) => {
    try {
      const rows = await storage.getHomeVisitsFiltered({
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        branch: req.query.branch as string | undefined,
        staffId: req.query.staffId as string | undefined,
        visitType: req.query.visitType as string | undefined,
      });
      return successResponse(res, rows);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.post("/api/home-visits", requireAuth, requirePatientsManage, async (req, res) => {
    try {
      const user = (req as any).user;
      const data = insertHomeVisitSchema.parse(req.body);
      const staff = await storage.getStaff(data.staffId);
      const patient = data.patientId ? await storage.getPatient(data.patientId) : undefined;
      const visitType = data.visitType || (await detectHomeVisitType(
        storage,
        data.staffId,
        String(data.visitDate ?? new Date().toISOString().slice(0, 10)),
        data.branch ?? patient?.branch ?? "Colombo"
      ));
      const settings = await storage.getClinicSettings();
      const rate = homeVisitRate(visitType as any, {
        homeColombo: Number(settings?.homeRateColombo ?? 1000),
        homeBandaragama: Number(settings?.homeRateBandaragama ?? 500),
      });
      const record = await storage.createHomeVisit({
        ...data,
        visitType,
        staffName: staff?.name ?? "",
        patientName: patient?.name ?? data.patientName ?? "",
        paymentAmount: String(rate),
      } as any);
      return successResponse(res, record, "Home visit created", 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.patch("/api/home-visits/:id", requireAuth, requirePatientsManage, async (req, res) => {
    try {
      const id = param(req, "id");
      const existing = await storage.getHomeVisit(id);
      if (!existing) return errorResponse(res, "Home visit not found", 404);

      const data = insertHomeVisitSchema.partial().parse(req.body);
      const staff = data.staffId ? await storage.getStaff(data.staffId) : await storage.getStaff(existing.staffId);
      const patient = data.patientId
        ? await storage.getPatient(data.patientId)
        : existing.patientId
          ? await storage.getPatient(existing.patientId)
          : undefined;

      const visitDate = String(data.visitDate ?? existing.visitDate ?? new Date().toISOString().slice(0, 10));
      const branch = data.branch ?? patient?.branch ?? existing.branch ?? "Colombo";
      const visitType =
        data.visitType ||
        (await detectHomeVisitType(storage, staff?.id ?? existing.staffId, visitDate, branch));
      const settings = await storage.getClinicSettings();
      const rate = homeVisitRate(visitType as any, {
        homeColombo: Number(settings?.homeRateColombo ?? 1000),
        homeBandaragama: Number(settings?.homeRateBandaragama ?? 500),
      });

      const record = await storage.updateHomeVisit(id, {
        ...data,
        visitType,
        staffName: staff?.name ?? existing.staffName,
        patientName: patient?.name ?? data.patientName ?? existing.patientName,
        paymentAmount: String(rate),
      } as any);
      const user = (req as any).user;
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "home_visit",
        action: "update",
        recordId: id,
        oldValue: existing,
        newValue: record,
      });
      return successResponse(res, record, "Home visit updated");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  app.delete("/api/home-visits/:id", requireAuth, requireCriticalDelete, async (req, res) => {
    try {
      const id = param(req, "id");
      const existing = await storage.getHomeVisit(id);
      if (!existing) return errorResponse(res, "Home visit not found", 404);
      const deleted = await storage.deleteHomeVisit(id);
      if (!deleted) return errorResponse(res, "Home visit not found", 404);
      const user = (req as any).user;
      await logAudit(storage, {
        userId: user.staffId,
        userName: await editorName(user.staffId),
        module: "home_visit",
        action: "delete",
        recordId: id,
        oldValue: existing,
      });
      return successResponse(res, { id }, "Home visit deleted");
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });
}
