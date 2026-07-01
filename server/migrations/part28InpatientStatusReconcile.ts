import { storage } from "../storage";
import {
  pickLatestAdmissionsPerPatient,
  isCurrentlyAdmitted,
} from "../services/inPatientAdmissionService";

/**
 * Fixes out-patient records left as Discharged after an in-patient re-admission
 * created a newer Admitted episode (Phase 4 backfill).
 */
export async function runPart28InpatientStatusReconcile(): Promise<void> {
  const all = await storage.getAllInPatientAdmissions();
  const latest = pickLatestAdmissionsPerPatient(all);
  let fixed = 0;

  for (const admission of latest) {
    if (!admission.patientId || !isCurrentlyAdmitted(admission)) continue;
    const patient = await storage.getPatient(admission.patientId);
    if (!patient || patient.status !== "Discharged") continue;
    await storage.updatePatient(admission.patientId, { status: "Active" });
    fixed += 1;
  }

  if (fixed > 0) {
    console.log(`[migration] Part 28: set ${fixed} patient(s) to Active after in-patient re-admission`);
  }
}
