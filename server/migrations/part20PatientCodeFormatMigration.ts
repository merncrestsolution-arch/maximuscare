/**
 * Part 20 — migrate patient codes to the MC/<BRANCH>/<DDMM>/<SEQ> format (Bug 2/9).
 *
 * Existing records use the legacy global format (MXM-YYYYMM-NNNNNN). This converts any
 * code that is not already in the current MC format, assigning sequences per branch + day
 * in registration order. Idempotent: codes already in MC format are left untouched and
 * seed the per-(branch+day) counters.
 */
import { asc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
  patientBranchCode,
  patientIdDayMonth,
  formatPatientCode,
  isCurrentPatientCode,
  parsePatientCodeSequence,
} from "@shared/patientId";

const { patients } = schema;

type PatientRow = {
  id: string;
  branch: string;
  patientCode: string | null;
  registeredDate: string;
};

export async function runPart20PatientCodeFormatMigration() {
  const rows: PatientRow[] = await db
    .select({
      id: patients.id,
      branch: patients.branch,
      patientCode: patients.patientCode,
      registeredDate: patients.registeredDate,
    })
    .from(patients)
    .orderBy(asc(patients.createdAt));

  const needsMigration = rows.some((r) => !isCurrentPatientCode(r.patientCode));
  if (!needsMigration) return;

  // Seed per-(branchCode/DDMM) sequence counters from codes already in the MC format.
  const maxSeq = new Map<string, number>();
  for (const r of rows) {
    if (!isCurrentPatientCode(r.patientCode)) continue;
    const branchCode = patientBranchCode(r.branch);
    const ddmm = patientIdDayMonth(r.registeredDate);
    const seq = parsePatientCodeSequence(r.patientCode, branchCode, ddmm);
    if (seq != null) {
      const key = `${branchCode}/${ddmm}`;
      maxSeq.set(key, Math.max(maxSeq.get(key) ?? 0, seq));
    }
  }

  let migrated = 0;
  for (const r of rows) {
    if (isCurrentPatientCode(r.patientCode)) continue;
    const branchCode = patientBranchCode(r.branch);
    const ddmm = patientIdDayMonth(r.registeredDate);
    const key = `${branchCode}/${ddmm}`;
    const next = (maxSeq.get(key) ?? 0) + 1;
    maxSeq.set(key, next);
    const code = formatPatientCode(branchCode, ddmm, next);

    await db
      .update(patients)
      .set({ patientCode: code, updatedAt: new Date() })
      .where(eq(patients.id, r.id));
    migrated += 1;
  }

  console.log(`[Part20] Migrated ${migrated} patient codes to MC/<BRANCH>/<DDMM>/<SEQ> format`);
}
