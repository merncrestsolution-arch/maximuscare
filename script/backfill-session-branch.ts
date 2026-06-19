/**
 * One-time backfill: set in_patient_sessions.branch_id for legacy rows that
 * were created before session branch attribution existed (Issue 11).
 *
 * Branch source priority (admissions carry no branch):
 *   1. the session's linked patient branch (if patientId set)
 *   2. the treating staff member's branch
 *
 * USAGE:
 *   Dry run (no writes, just prints the plan):
 *     npx tsx script/backfill-session-branch.ts
 *   Apply changes:
 *     npx tsx script/backfill-session-branch.ts --apply
 */
import "dotenv/config";
import { storage } from "../server/storage";
import { resolveBranchIdByName } from "../server/services/branchService";

async function main() {
  const apply = process.argv.includes("--apply");

  const sessions = await storage.getAllInPatientSessionsInDateRange("2000-01-01", "2100-01-01");
  const staffList = await storage.getAllStaff();
  const staffMap = new Map(staffList.map((s) => [s.id, s]));
  const patients = await storage.getAllPatients();
  const patMap = new Map(patients.map((p) => [p.id, p]));

  let resolved = 0;
  let skippedHasBranch = 0;
  let unresolved = 0;

  for (const s of sessions) {
    if ((s as any).branchId) {
      skippedHasBranch += 1;
      continue;
    }
    const patient = s.patientId ? (patMap.get(s.patientId) as any) : null;
    const staff = staffMap.get(s.treatingStaffId);
    const branchName = patient?.branch ?? staff?.branch ?? null;
    const branchId = await resolveBranchIdByName(storage, branchName);

    if (!branchId) {
      unresolved += 1;
      console.log(
        `  UNRESOLVED session=${s.id} date=${s.sessionDate} staff=${s.treatingStaffName} (no branch found)`
      );
      continue;
    }

    resolved += 1;
    console.log(
      `  ${apply ? "UPDATE" : "WOULD UPDATE"} session=${s.id} date=${s.sessionDate} ` +
        `staff=${s.treatingStaffName} branchName=${branchName} -> branchId=${branchId}`
    );
    if (apply) {
      await storage.updateInPatientSession(s.id, { branchId } as any);
    }
  }

  console.log(
    `\nDone. ${apply ? "applied" : "dry-run"} | resolved=${resolved} unresolved=${unresolved} alreadySet=${skippedHasBranch} total=${sessions.length}`
  );
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
