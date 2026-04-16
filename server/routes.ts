import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { db, schema } from "./db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const {
  staff: staffTable,
  insertStaffSchema,
  updateStaffSchema,
  insertPatientSchema,
  updatePatientSchema,
  insertVisitSchema,
  updateVisitSchema,
  insertAttendanceSchema,
  updateAttendanceSchema,
  insertInPatientAdmissionSchema,
  updateInPatientAdmissionSchema,
  insertInPatientSessionSchema,
  updateInPatientSessionSchema,
  insertInPatientDischargeSchema,
  insertInPatientPaymentSchema,
  updateInPatientDischargeSchema,
  insertExpenseSchema,
  updateExpenseSchema,
  insertInPatientExtraExpenseSchema,
  updateInPatientExtraExpenseSchema,
  insertAppointmentSchema,
  updateAppointmentSchema,
} = schema;
import { z } from "zod";

// Session store (in-memory for now)
const sessions = new Map<string, { staffId: string; email: string; role: string }>();

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function normalizeAttachmentInput(value: unknown): string[] | string | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return undefined;
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => (typeof item === "string" ? item : item == null ? "" : String(item)))
      .filter((item) => item.trim().length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .map((item) => (typeof item === "string" ? item : item == null ? "" : String(item)))
            .filter((item) => item.trim().length > 0);
          return cleaned.length > 0 ? cleaned : undefined;
        }
      } catch {
        return undefined;
      }
    }
    return value;
  }
  return undefined;
}

function normalizeInPatientAdmissionBody(body: Record<string, unknown>) {
  const normalized = {
    ...body,
    reportsAttachments: normalizeAttachmentInput(body.reportsAttachments),
    idCopyAttachments: normalizeAttachmentInput(body.idCopyAttachments),
  };
  if (normalized.reportsAttachments === undefined) delete (normalized as any).reportsAttachments;
  if (normalized.idCopyAttachments === undefined) delete (normalized as any).idCopyAttachments;
  return normalized;
}

// Middleware to check authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers.authorization?.replace("Bearer ", "");
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ message: "Login expired. Please re-login." });
  }
  const session = sessions.get(sessionId)!;
  (req as any).user = session;
  next();
}

// Middleware to check roles
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }
    next();
  };
}

async function autoMarkMissingAttendanceForPreviousDay() {
  const previousDay = new Date();
  previousDay.setDate(previousDay.getDate() - 1);
  const date = previousDay.toISOString().split("T")[0];
  const allStaff = await storage.getAllStaff();
  const targetStaff = allStaff.filter((s) => !["Admin", "MD"].includes(s.role));

  for (const staff of targetStaff) {
    const existing = await storage.getAttendanceByStaffAndDate(staff.id, date);
    if (existing) continue;
    await storage.createAttendance({
      staffId: staff.id,
      staffName: staff.name,
      role: staff.role as any,
      date,
      status: "Absent",
    } as any);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check (for Render, Railway, etc.)
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      app: "Maximus Care",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    })
  );

  // ========== Authentication Routes ==========
  
  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const staff = await storage.getStaffByEmail(email);
      
      if (!staff || !staff.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, staff.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate session ID (cryptographically secure)
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, { staffId: staff.id, email: staff.email, role: staff.role });

      // Return user without password
      const { password: _, ...userWithoutPassword } = staff;
      return res.json({ user: userWithoutPassword, sessionId });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const staff = await storage.getStaff(user.staffId);
      if (!staff) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = staff;
      return res.json(userWithoutPassword);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Logout
  app.post("/api/auth/logout", requireAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers.authorization?.replace("Bearer ", "");
    if (sessionId) {
      sessions.delete(sessionId);
    }
    return res.json({ message: "Logged out successfully" });
  });

  // ========== Staff Routes ==========
  
  // Get all staff (Admin/MD get full list, others get only themselves)
  app.get("/api/staff", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      const isAdmin = ["Admin", "MD"].includes(currentUser.role);

      if (isAdmin) {
        const allStaff = await storage.getAllStaff();
        const staffWithoutPasswords = allStaff.map(({ password, ...staff }) => staff);
        return res.json(staffWithoutPasswords);
      } else {
        const selfStaff = await storage.getStaff(currentUser.staffId);
        if (!selfStaff) {
          return res.json([]);
        }
        const { password, ...staffWithoutPassword } = selfStaff;
        return res.json([staffWithoutPassword]);
      }
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single staff (own profile or Admin/MD)
  app.get("/api/staff/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const currentUser = (req as any).user;
      
      // Allow user to view own profile, or Admin/MD to view any profile
      if (currentUser.staffId !== id && !["Admin", "MD"].includes(currentUser.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const staff = await storage.getStaff(id);
      if (!staff) {
        return res.status(404).json({ message: "Staff not found" });
      }
      const { password: _, ...staffWithoutPassword } = staff;
      return res.json(staffWithoutPassword);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create staff (Admin and MD)
  app.post("/api/staff", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const validatedData = insertStaffSchema.parse(req.body);
      
      // Check if email already exists
      const existingStaff = await storage.getStaffByEmail(validatedData.email);
      if (existingStaff) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      const staff = await storage.createStaff({
        ...validatedData,
        password: hashedPassword,
      });

      const { password: _, ...staffWithoutPassword } = staff;
      return res.status(201).json(staffWithoutPassword);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Update staff (own profile or Admin)
  app.patch("/api/staff/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const currentUser = (req as any).user;
      
      // Allow user to update own profile, or Admin/MD to update any profile
      if (currentUser.staffId !== id && !["Admin", "MD"].includes(currentUser.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const validatedData = updateStaffSchema.parse(req.body);
      const staff = await storage.updateStaff(id, validatedData);
      
      if (!staff) {
        return res.status(404).json({ message: "Staff not found" });
      }

      const { password: _, ...staffWithoutPassword } = staff;
      return res.json(staffWithoutPassword);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Update staff password (Admin/MD only, or own password)
  app.patch("/api/staff/:id/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const { password, email } = req.body;
      const currentUser = (req as any).user;
      
      // Allow Admin/MD to update any password, or user to update own
      if (currentUser.staffId !== id && !["Admin", "MD"].includes(currentUser.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!password || password.length < 4) {
        return res.status(400).json({ message: "Password must be at least 4 characters" });
      }

      // Check if email is being changed and validate uniqueness
      if (email && ["Admin", "MD"].includes(currentUser.role)) {
        const existingStaff = await storage.getStaff(id);
        if (existingStaff && email !== existingStaff.email) {
          const emailExists = await storage.getStaffByEmail(email);
          if (emailExists) {
            return res.status(400).json({ message: "Email already in use" });
          }
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Build update data
      const updateData: any = { password: hashedPassword };
      if (email && ["Admin", "MD"].includes(currentUser.role)) {
        updateData.email = email;
      }

      const result = await db
        .update(staffTable)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(staffTable.id, id))
        .returning();

      if (!result.length) {
        return res.status(404).json({ message: "Staff not found" });
      }

      const { password: _, ...staffWithoutPassword } = result[0];
      return res.json(staffWithoutPassword);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete staff (Admin only)
  app.delete("/api/staff/:id", requireAuth, requireRole("Admin"), async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const deleted = await storage.deleteStaff(id);
      if (!deleted) {
        return res.status(404).json({ message: "Staff not found" });
      }
      return res.json({ message: "Staff deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Patient Routes ==========
  
  // Get all patients
  app.get("/api/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const branch = req.query.branch as string | undefined;
      let patients;
      if (branch) {
        patients = await storage.getPatientsByBranch(branch);
      } else {
        patients = await storage.getAllPatients();
      }
      return res.json(patients);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single patient
  app.get("/api/patients/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const patient = await storage.getPatient(id);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      return res.json(patient);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create patient (Receptionist, Physiotherapist, Admin, MD)
  app.post("/api/patients", requireAuth, requireRole("Receptionist", "Physiotherapist", "Admin", "MD", "Staff"), async (req: Request, res: Response) => {
    try {
      const validatedData = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(validatedData);
      return res.status(201).json(patient);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Update patient
  app.patch("/api/patients/:id", requireAuth, requireRole("Receptionist", "Physiotherapist", "Admin", "MD", "Staff"), async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const validatedData = updatePatientSchema.parse(req.body);
      const patient = await storage.updatePatient(id, validatedData);
      
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      return res.json(patient);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete patient (Admin, MD) — cascades visits and appointments in storage to satisfy FK constraints
  app.delete("/api/patients/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const deleted = await storage.deletePatient(id);
      if (!deleted) {
        return res.status(404).json({ message: "Patient not found" });
      }
      return res.json({ message: "Patient deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to delete patient" });
    }
  });

  // ========== Visit Routes ==========
  
  // Get all visits
  app.get("/api/visits", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patientId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      let visits;

      if (patientId) {
        visits = await storage.getVisitsByPatient(patientId);
      } else if (startDate && endDate) {
        visits = await storage.getVisitsByDateRange(startDate, endDate);
      } else {
        visits = await storage.getAllVisits();
      }

      return res.json(visits);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single visit
  app.get("/api/visits/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const visit = await storage.getVisit(id);
      if (!visit) {
        return res.status(404).json({ message: "Visit not found" });
      }
      return res.json(visit);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create visit
  app.post("/api/visits", requireAuth, requireRole("Physiotherapist", "Admin", "MD", "Receptionist", "Staff"), async (req: Request, res: Response) => {
    try {
      const validatedData = insertVisitSchema.parse(req.body);
      const visit = await storage.createVisit(validatedData);
      return res.status(201).json(visit);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Update visit
  app.patch("/api/visits/:id", requireAuth, requireRole("Physiotherapist", "Admin", "MD", "Receptionist", "Staff"), async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const validatedData = updateVisitSchema.parse(req.body);
      const visit = await storage.updateVisit(id, validatedData);
      
      if (!visit) {
        return res.status(404).json({ message: "Visit not found" });
      }
      return res.json(visit);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete visit
  app.delete("/api/visits/:id", requireAuth, requireRole("Physiotherapist", "Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const deleted = await storage.deleteVisit(id);
      if (!deleted) {
        return res.status(404).json({ message: "Visit not found" });
      }
      return res.json({ message: "Visit deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Attendance Routes ==========
  
  // Get attendance records
  app.get("/api/attendance", requireAuth, async (req: Request, res: Response) => {
    try {
      await autoMarkMissingAttendanceForPreviousDay();
      const staffId = req.query.staffId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const month = req.query.month as string | undefined;
      const currentUser = (req as any).user;
      const isAdmin = ["Admin", "MD"].includes(currentUser.role);
      let attendance;

      if (month && staffId) {
        if (currentUser.staffId !== staffId && !isAdmin) {
          return res.status(403).json({ message: "Forbidden" });
        }
        attendance = await storage.getAttendanceByStaffAndMonth(staffId, month);
      } else if (staffId) {
        if (currentUser.staffId !== staffId && !isAdmin) {
          return res.status(403).json({ message: "Forbidden" });
        }
        attendance = await storage.getAttendanceByStaff(staffId);
      } else if (startDate && endDate) {
        if (isAdmin) {
          attendance = await storage.getAttendanceByDateRange(startDate, endDate);
        } else {
          attendance = await storage.getAttendanceByStaff(currentUser.staffId);
          attendance = attendance.filter((a: any) => {
            const d = a.date;
            return d >= startDate && d <= endDate;
          });
        }
      } else if (month) {
        if (isAdmin) {
          attendance = await storage.getAllAttendance();
        } else {
          attendance = await storage.getAttendanceByStaffAndMonth(currentUser.staffId, month);
        }
      } else {
        if (isAdmin) {
          attendance = await storage.getAllAttendance();
        } else {
          attendance = await storage.getAttendanceByStaff(currentUser.staffId);
        }
      }

      return res.json(attendance);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create attendance record
  app.post("/api/attendance", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      const body = req.body;
      const todayStr = new Date().toISOString().split('T')[0];

      const status = body.status;
      if (!status || !["Present", "Absent"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'Present' or 'Absent'" });
      }

      const canManageOthers = ["Admin", "MD"].includes(currentUser.role);

      let targetStaffId: string;
      let targetStaffName: string;
      let targetRole: string;
      let attendanceDate: string;

      if (canManageOthers && body.staffId && body.staffId !== currentUser.staffId) {
        const targetStaff = await storage.getStaff(body.staffId);
        if (!targetStaff) {
          return res.status(400).json({ message: "Target staff not found" });
        }
        targetStaffId = targetStaff.id;
        targetStaffName = targetStaff.name;
        targetRole = targetStaff.role;
        attendanceDate = body.date ? String(body.date).split('T')[0] : todayStr;
      } else {
        const currentStaff = await storage.getStaff(currentUser.staffId);
        if (!currentStaff) {
          return res.status(400).json({ message: "Staff not found" });
        }
        targetStaffId = currentStaff.id;
        targetStaffName = currentStaff.name;
        targetRole = currentStaff.role;

        if (!canManageOthers) {
          attendanceDate = todayStr;
        } else {
          attendanceDate = body.date ? String(body.date).split('T')[0] : todayStr;
        }
      }

      const checkInTime = body.checkInTime ? new Date(body.checkInTime) : (status === 'Present' ? new Date() : undefined);

      console.log(`[ATTENDANCE] staffId=${targetStaffId}, date=${attendanceDate}, status=${status}`);

      const existing = await storage.getAttendanceByStaffAndDate(targetStaffId, attendanceDate);
      if (existing) {
        if (!canManageOthers) {
          return res.status(409).json({ message: "Attendance already marked for today. Contact Admin/MD to edit." });
        }
        const updateData: Record<string, any> = { status, updatedAt: new Date() };
        if (checkInTime) updateData.checkInTime = checkInTime;
        const updated = await storage.updateAttendance(existing.id, updateData);
        return res.json(updated);
      }

      const attendanceData: any = {
        staffId: targetStaffId,
        staffName: targetStaffName,
        role: targetRole,
        date: attendanceDate,
        status,
        checkInTime: checkInTime || undefined,
      };

      const result = await storage.createAttendance(attendanceData);
      return res.status(201).json(result);
    } catch (error: any) {
      console.error(`[ATTENDANCE ERROR]`, error.message || error);
      if (error.code === '23505' || (error.message && error.message.includes('duplicate'))) {
        return res.status(409).json({ message: "Attendance already marked for today. Contact Admin/MD to edit." });
      }
      return res.status(500).json({ message: error.message || "Failed to mark attendance" });
    }
  });

  // Update attendance record
  app.patch("/api/attendance/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const currentUser = (req as any).user;
      const raw = req.body as Record<string, unknown>;
      const body = { ...raw };
      const clearCheckIn = body.checkInTime === null || body.checkInTime === "";
      const clearCheckOut = body.checkOutTime === null || body.checkOutTime === "";
      if (clearCheckIn) delete (body as any).checkInTime;
      if (clearCheckOut) delete (body as any).checkOutTime;
      if (body.checkOutTime && typeof body.checkOutTime === 'string') {
        body.checkOutTime = new Date(body.checkOutTime);
      }
      if (body.checkInTime && typeof body.checkInTime === 'string') {
        body.checkInTime = new Date(body.checkInTime);
      }
      if (body.overtimeHours !== undefined && body.overtimeHours !== null) {
        body.overtimeHours = String(Number(body.overtimeHours));
      }
      const validatedData = updateAttendanceSchema.parse(body);
      
      // First get the existing attendance record to check ownership
      const existingAttendance = await storage.getAttendance(id);
      if (!existingAttendance) {
        return res.status(404).json({ message: "Attendance record not found" });
      }
      
      // Admin, MD can update attendance for anyone on any date
      // All other staff can only update their own attendance for today only
      const canManageOthers = ["Admin", "MD"].includes(currentUser.role);
      
      if (!canManageOthers) {
        if (existingAttendance.staffId !== currentUser.staffId) {
          return res.status(403).json({ message: "You can only update your own attendance" });
        }
        const today = new Date().toISOString().split('T')[0];
        if (existingAttendance.date !== today) {
          return res.status(403).json({ message: "You can only update today's attendance" });
        }
        delete validatedData.staffId;
        delete validatedData.staffName;
        delete validatedData.role;
        delete validatedData.date;
        delete validatedData.status;
      }
      
      const patch: Record<string, unknown> = { ...validatedData };
      if (canManageOthers) {
        if (clearCheckIn) patch.checkInTime = null;
        if (clearCheckOut) patch.checkOutTime = null;
        if (validatedData.status === "Absent") {
          patch.checkInTime = null;
          patch.checkOutTime = null;
        }
      }
      
      const attendance = await storage.updateAttendance(id, patch as any);
      return res.json(attendance);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete attendance record (Admin/MD only)
  app.delete("/api/attendance/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const id = param(req, "id");
      const existing = await storage.getAttendance(id);
      if (!existing) {
        return res.status(404).json({ message: "Attendance record not found" });
      }
      await storage.deleteAttendance(id);
      return res.json({ message: "Attendance record deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Incentive Settings Routes ==========

  app.get("/api/incentive-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getIncentiveSettings();
      if (!settings) {
        return res.json({
          incentiveEnabled: "true",
          minPatientsForIncentive: 5,
          incentivePerPatient: 100,
          clinicLocationScope: "Colombo",
        });
      }
      return res.json(settings);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/incentive-settings", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const { incentiveEnabled, minPatientsForIncentive, incentivePerPatient, clinicLocationScope } = req.body;
      const data: any = {};
      if (incentiveEnabled !== undefined) data.incentiveEnabled = String(incentiveEnabled);
      if (minPatientsForIncentive !== undefined) data.minPatientsForIncentive = Number(minPatientsForIncentive);
      if (incentivePerPatient !== undefined) data.incentivePerPatient = Number(incentivePerPatient);
      if (clinicLocationScope !== undefined) data.clinicLocationScope = clinicLocationScope;

      const settings = await storage.updateIncentiveSettings(data);
      return res.json(settings);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Reports/Statistics Routes ==========
  
  // Get visit statistics for physio summary/reports
  app.get("/api/reports/visit-stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const staffId = req.query.staffId as string | undefined;
      const currentUser = (req as any).user;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      let visits;
      // Physiotherapists can only view their own stats
      if (currentUser.role === "Physiotherapist") {
        visits = await storage.getVisitsByStaffAndDateRange(currentUser.staffId, startDate, endDate);
      } else if (staffId) {
        // Admin/MD can filter by specific staff
        visits = await storage.getVisitsByStaffAndDateRange(staffId, startDate, endDate);
      } else {
        // Admin/MD can see all visits
        visits = await storage.getVisitsByDateRange(startDate, endDate);
      }

      // Calculate statistics
      const stats = {
        colomboClinic: visits.filter(v => v.branch === "Colombo" && v.visitType === "Clinic").length,
        colomboHome: visits.filter(v => v.branch === "Colombo" && v.visitType === "Home").length,
        bandaragamaClinic: visits.filter(v => v.branch === "Bandaragama" && v.visitType === "Clinic").length,
        bandaragamaHome: visits.filter(v => v.branch === "Bandaragama" && v.visitType === "Home").length,
      };

      // Calculate incentives (Colombo all visits, ≥5 patients/day = 100 LKR per patient)
      const colomboClinicVisits = visits.filter(v => v.branch === "Colombo");
      
      // Group by treating staff and date
      const visitsByStaffAndDate = new Map<string, Map<string, number>>();
      colomboClinicVisits.forEach(visit => {
        if (!visitsByStaffAndDate.has(visit.treatingStaffId)) {
          visitsByStaffAndDate.set(visit.treatingStaffId, new Map());
        }
        const staffVisits = visitsByStaffAndDate.get(visit.treatingStaffId)!;
        const count = staffVisits.get(visit.visitDate) || 0;
        staffVisits.set(visit.visitDate, count + 1);
      });

      // Calculate incentives
      const incentivesByStaff = new Map<string, { staffName: string; totalIncentive: number; breakdown: Array<{ date: string; count: number; incentive: number }> }>();
      
      visitsByStaffAndDate.forEach((dateMap, staffId) => {
        const staffVisit = colomboClinicVisits.find(v => v.treatingStaffId === staffId);
        if (!staffVisit) return;

        const breakdown: Array<{ date: string; count: number; incentive: number }> = [];
        let totalIncentive = 0;

        dateMap.forEach((count, date) => {
          const incentive = count >= 5 ? count * 100 : 0;
          totalIncentive += incentive;
          if (incentive > 0) {
            breakdown.push({ date, count, incentive });
          }
        });

        if (totalIncentive > 0 || breakdown.length > 0) {
          incentivesByStaff.set(staffId, {
            staffName: staffVisit.treatingStaffName,
            totalIncentive,
            breakdown: breakdown.sort((a, b) => a.date.localeCompare(b.date)),
          });
        }
      });

      const incentives = Array.from(incentivesByStaff.values());

      return res.json({ stats, incentives, visits });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== In-Patient Admission Routes ==========

  // Get all in-patient admissions
  app.get("/api/inpatients", requireAuth, async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      let admissions;
      if (status && typeof status === 'string') {
        admissions = await storage.getInPatientAdmissionsByStatus(status);
      } else {
        admissions = await storage.getAllInPatientAdmissions();
      }
      return res.json(admissions);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single in-patient admission
  app.get("/api/inpatients/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const admission = await storage.getInPatientAdmission(param(req, "id"));
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      return res.json(admission);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create in-patient admission (Admin, MD, Receptionist, Physiotherapist)
  app.post("/api/inpatients", requireAuth, requireRole("Admin", "MD", "Receptionist", "Physiotherapist"), async (req: Request, res: Response) => {
    try {
      const normalizedBody = normalizeInPatientAdmissionBody(req.body as Record<string, unknown>);
      const parsed = insertInPatientAdmissionSchema.safeParse(normalizedBody);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const d = parsed.data;
      const admission = await storage.createInPatientAdmission({
        ...d,
        reportsAttachments: (d as any).reportsAttachments ?? null,
        idCopyAttachments: (d as any).idCopyAttachments ?? null,
      } as any);
      return res.status(201).json(admission);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Update in-patient admission (Admin, MD)
  app.put("/api/inpatients/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const normalizedBody = normalizeInPatientAdmissionBody(req.body as Record<string, unknown>);
      const parsed = updateInPatientAdmissionSchema.safeParse(normalizedBody);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const admission = await storage.updateInPatientAdmission(param(req, "id"), parsed.data);
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      return res.json(admission);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete in-patient admission (Admin, MD only)
  app.delete("/api/inpatients/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteInPatientAdmission(param(req, "id"));
      if (!success) {
        return res.status(404).json({ message: "Admission not found" });
      }
      return res.json({ message: "Admission deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== In-Patient Session Routes ==========

  // Get all sessions for an admission
  app.get("/api/inpatients/:admissionId/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const sessions = await storage.getInPatientSessionsByAdmission(param(req, "admissionId"));
      return res.json(sessions);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get next session number for a date
  app.get("/api/inpatients/:admissionId/sessions/next-number", requireAuth, async (req: Request, res: Response) => {
    try {
      const { date } = req.query;
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: "Date is required" });
      }
      const count = await storage.getSessionCountForDate(param(req, "admissionId"), date);
      return res.json({ nextSessionNumber: count + 1 });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create in-patient session (All authenticated staff can add sessions)
  app.post("/api/inpatients/:admissionId/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const admission = await storage.getInPatientAdmission(param(req, "admissionId"));
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      if (admission.status === 'Discharged') {
        return res.status(400).json({ message: "Cannot add session to discharged patient" });
      }

      // Auto-calculate session number
      const sessionDate = req.body.sessionDate || new Date().toISOString().split('T')[0];
      const existingCount = await storage.getSessionCountForDate(param(req, "admissionId"), sessionDate);
      const sessionNumber = existingCount + 1;

      const data = {
        ...req.body,
        admissionId: param(req, "admissionId"),
        patientName: admission.patientName,
        sessionNumber,
      };

      const parsed = insertInPatientSessionSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }

      const sd = parsed.data;
      const session = await storage.createInPatientSession({
        ...sd,
        sessionNumber,
        attachments: (sd as any).attachments ?? null,
      } as any);
      return res.status(201).json(session);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Update in-patient session (Admin, MD, or the treating physiotherapist)
  app.put("/api/inpatients/sessions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const existingSession = await storage.getInPatientSession(param(req, "id"));
      if (!existingSession) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Check permission: Admin/MD can edit any, Physiotherapist can edit own
      if (user.role !== 'Admin' && user.role !== 'MD' && existingSession.treatingStaffId !== user.staffId) {
        return res.status(403).json({ message: "You can only edit your own sessions" });
      }

      const parsed = updateInPatientSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const session = await storage.updateInPatientSession(param(req, "id"), parsed.data);
      return res.json(session);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete in-patient session (Admin, MD only)
  app.delete("/api/inpatients/sessions/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteInPatientSession(param(req, "id"));
      if (!success) {
        return res.status(404).json({ message: "Session not found" });
      }
      return res.json({ message: "Session deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== In-Patient Discharge Routes ==========

  // Get discharge info for an admission
  app.get("/api/inpatients/:admissionId/discharge", requireAuth, async (req: Request, res: Response) => {
    try {
      const discharge = await storage.getInPatientDischargeByAdmission(param(req, "admissionId"));
      if (!discharge) {
        return res.status(404).json({ message: "Discharge record not found" });
      }
      return res.json(discharge);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create discharge (Admin, MD only)
  app.post("/api/inpatients/:admissionId/discharge", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const admission = await storage.getInPatientAdmission(param(req, "admissionId"));
      if (!admission) {
        return res.status(404).json({ message: "Admission not found" });
      }
      if (admission.status === 'Discharged') {
        return res.status(400).json({ message: "Patient already discharged" });
      }

      const data = {
        ...req.body,
        admissionId: param(req, "admissionId"),
        patientName: admission.patientName,
      };

      const parsed = insertInPatientDischargeSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }

      // Create discharge record
      const discharge = await storage.createInPatientDischarge(parsed.data);

      // Update admission status to Discharged
      await storage.updateInPatientAdmission(param(req, "admissionId"), { status: 'Discharged' });

      return res.status(201).json(discharge);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Update discharge (Admin, MD only)
  app.put("/api/inpatients/discharge/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const parsed = updateInPatientDischargeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      const discharge = await storage.updateInPatientDischarge(param(req, "id"), parsed.data);
      if (!discharge) {
        return res.status(404).json({ message: "Discharge record not found" });
      }
      return res.json(discharge);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== IN-PATIENT PAYMENTS ==========

  // Get payments for an admission (Admin, MD, Receptionist)
  app.get("/api/inpatients/:admissionId/payments", requireAuth, requireRole("Admin", "MD", "Receptionist"), async (req: Request, res: Response) => {
    try {
      const payments = await storage.getInPatientPaymentsByAdmission(param(req, "admissionId"));
      return res.json(payments);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get payment total for an admission (Admin, MD, Receptionist)
  app.get("/api/inpatients/:admissionId/payments/total", requireAuth, requireRole("Admin", "MD", "Receptionist"), async (req: Request, res: Response) => {
    try {
      const total = await storage.getPaymentTotalByAdmission(param(req, "admissionId"));
      return res.json({ total });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create payment (Admin, MD, Receptionist)
  app.post("/api/inpatients/:admissionId/payments", requireAuth, requireRole("Admin", "MD", "Receptionist"), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const staffInfo = await storage.getStaff(user.staffId);

      const body = { ...req.body };
      if (body.notes === '' || body.notes === undefined) body.notes = null;
      if (body.amount !== undefined) body.amount = String(body.amount);

      const data = {
        ...body,
        admissionId: param(req, "admissionId"),
        createdByStaffId: user.staffId,
        createdByName: staffInfo?.name || 'Unknown',
      };

      const parsed = insertInPatientPaymentSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten(), received: req.body });
      }

      const payment = await storage.createInPatientPayment(parsed.data);
      return res.status(201).json(payment);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== In-Patient Extra Expense Routes ==========

  app.get("/api/inpatients/:admissionId/extra-expenses", requireAuth, async (req: Request, res: Response) => {
    try {
      const expenses = await storage.getInPatientExtraExpensesByAdmission(param(req, "admissionId"));
      return res.json(expenses);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/inpatients/:admissionId/extra-expenses/total", requireAuth, async (req: Request, res: Response) => {
    try {
      const total = await storage.getExtraExpenseTotalByAdmission(param(req, "admissionId"));
      return res.json({ total });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/inpatients/:admissionId/extra-expenses", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const staffInfo = await storage.getStaff(user.staffId);

      const body = { ...req.body };
      if (body.description === '' || body.description === undefined) body.description = null;
      if (body.amount !== undefined) body.amount = String(body.amount);

      const data = {
        ...body,
        admissionId: param(req, "admissionId"),
        createdByStaffId: user.staffId,
        createdByStaffName: staffInfo?.name || 'Unknown',
      };

      const parsed = insertInPatientExtraExpenseSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten() });
      }

      const expense = await storage.createInPatientExtraExpense(parsed.data);
      return res.status(201).json(expense);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/inpatients/extra-expenses/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const body = { ...req.body };
      if (body.description === '') body.description = null;
      if (body.amount !== undefined) body.amount = String(body.amount);

      const parsed = updateInPatientExtraExpenseSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten() });
      }

      const expense = await storage.updateInPatientExtraExpense(param(req, "id"), parsed.data);
      if (!expense) {
        return res.status(404).json({ message: "Extra expense not found" });
      }
      return res.json(expense);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/inpatients/extra-expenses/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteInPatientExtraExpense(param(req, "id"));
      if (!deleted) {
        return res.status(404).json({ message: "Extra expense not found" });
      }
      return res.json({ message: "Extra expense deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Expense Routes (MD/Admin only) ==========

  // Get all expenses
  app.get("/api/expenses", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      let expensesList;
      
      if (startDate && endDate) {
        expensesList = await storage.getExpensesByDateRange(startDate as string, endDate as string);
      } else {
        expensesList = await storage.getAllExpenses();
      }
      
      return res.json(expensesList);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get my expenses (for staff to view their own expenses only) - must be before :id route
  app.get("/api/expenses/my", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const expensesList = await storage.getExpensesByStaffId(user.staffId);
      return res.json(expensesList);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Get single expense
  app.get("/api/expenses/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const expense = await storage.getExpense(param(req, "id"));
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      return res.json(expense);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Create expense (all authenticated users can add expenses)
  app.post("/api/expenses", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const staffInfo = await storage.getStaff(user.staffId);
      
      const body = { ...req.body };
      if (body.description === '' || body.description === undefined) body.description = null;
      
      const data = {
        ...body,
        createdByStaffId: user.staffId,
        createdByName: staffInfo?.name || 'Unknown',
      };
      
      const parsed = insertExpenseSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      
      const expense = await storage.createExpense(parsed.data);
      return res.status(201).json(expense);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Update expense
  app.patch("/api/expenses/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const body = { ...req.body };
      if (body.description === '') body.description = null;
      const parsed = updateExpenseSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      }
      
      const expense = await storage.updateExpense(param(req, "id"), parsed.data);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      return res.json(expense);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Delete expense
  app.delete("/api/expenses/:id", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteExpense(param(req, "id"));
      if (!deleted) {
        return res.status(404).json({ message: "Expense not found" });
      }
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Revenue Summary Routes (MD/Admin only) ==========

  // Get revenue summary
  app.get("/api/revenue-summary", requireAuth, requireRole("Admin", "MD"), async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      let totalIncome: number;
      let totalExpenses: number;
      
      if (startDate && endDate) {
        totalIncome = await storage.getTotalIncome(startDate as string, endDate as string);
        totalExpenses = await storage.getExpenseTotal(startDate as string, endDate as string);
      } else {
        totalIncome = await storage.getTotalIncome();
        totalExpenses = await storage.getExpenseTotal();
      }
      
      const netRevenue = totalIncome - totalExpenses;
      
      return res.json({
        totalIncome,
        totalExpenses,
        netRevenue,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // Initialize database with a default admin user if none exists
  app.post("/api/init", async (req: Request, res: Response) => {
    try {
      const allStaff = await storage.getAllStaff();
      if (allStaff.length === 0) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await storage.createStaff({
          name: "Admin User",
          email: "admin@maximuscare.com",
          password: hashedPassword,
          role: "Admin",
          branch: "Both",
        });
        return res.json({ message: "Admin user created successfully" });
      }
      return res.json({ message: "Database already initialized" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  // ========== Appointment Routes ==========

  app.get("/api/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      const { date } = req.query;
      if (date) {
        const appts = await storage.getAppointmentsByDate(date as string);
        return res.json(appts);
      }
      const appts = await storage.getAllAppointments();
      return res.json(appts);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/appointments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const appt = await storage.getAppointment(param(req, "id"));
      if (!appt) return res.status(404).json({ message: "Appointment not found" });
      return res.json(appt);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/appointments", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const body = { ...req.body };
      if (body.notes === '' || body.notes === undefined) body.notes = null;

      const data = {
        ...body,
        createdByStaffId: user.staffId,
      };

      const parsed = insertAppointmentSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten() });
      }

      const appt = await storage.createAppointment(parsed.data);
      return res.status(201).json(appt);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/appointments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const body = { ...req.body };
      if (body.notes === '') body.notes = null;

      const parsed = updateAppointmentSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", details: parsed.error.flatten() });
      }

      const appt = await storage.updateAppointment(param(req, "id"), parsed.data);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });
      return res.json(appt);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/appointments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteAppointment(param(req, "id"));
      if (!deleted) return res.status(404).json({ message: "Appointment not found" });
      return res.json({ message: "Appointment deleted" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
