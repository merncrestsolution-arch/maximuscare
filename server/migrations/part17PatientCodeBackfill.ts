/**
 * Part 17 — assign unique branch-scoped patient IDs to records missing patient_code.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { bumpPatientIdSequence, nextPatientIdFromCodes } from "@shared/patientId";

const { patients } = schema;

type PatientCodeRow = {
  id: string;
  branch: string;
  patientCode: string | null;
  registeredDate: string;
};

export async function runPart17PatientCodeBackfill() {
  const rows: PatientCodeRow[] = await db
    .select({
      id: patients.id,
      branch: patients.branch,
      patientCode: patients.patientCode,
      registeredDate: patients.registeredDate,
    })
    .from(patients);

  const missing = rows.filter((r: PatientCodeRow) => !String(r.patientCode ?? "").trim());
  if (missing.length === 0) return;

  const assigned = new Set(rows.map((r: PatientCodeRow) => String(r.patientCode ?? "").trim()).filter(Boolean));
  const branchCodes: Array<string | null | undefined> = rows.map((r: PatientCodeRow) => r.patientCode);

  for (const patient of missing) {
    let code = nextPatientIdFromCodes(branchCodes, patient.registeredDate);
    let guard = 0;
    while (assigned.has(code) && guard < 1000) {
      code = bumpPatientIdSequence(code);
      guard += 1;
    }
    assigned.add(code);
    branchCodes.push(code);

    await db
      .update(patients)
      .set({ patientCode: code, updatedAt: new Date() })
      .where(eq(patients.id, patient.id));
  }
}
