import { db } from "../db";
import { sql } from "drizzle-orm";

const usePostgres = !!process.env.DATABASE_URL?.startsWith("postgres");

async function run(statement: string) {
  const query = sql.raw(statement);
  if (usePostgres) {
    await (db as { execute: (q: ReturnType<typeof sql.raw>) => Promise<unknown> }).execute(query);
  } else {
    await db.run(query);
  }
}

/**
 * Backfill in_patient_sessions.branch_id from the parent admission's branch.
 *
 * In-patient session rows used to derive their branch from the treating staff
 * member's home branch, but staff can treat in-patients at a branch other than
 * their own — leaving sessions with a null or mismatched branch_id. Those
 * sessions then dropped out of the branch-scoped dashboard (the "Total IP
 * Sessions" card and the Visit Analytics "Sessions" bar). The admission always
 * carries the correct branch, so adopt it as the source of truth for any
 * session missing a branch attribution.
 */
export async function runPart23SessionBranchBackfill() {
  try {
    await run(
      `UPDATE in_patient_sessions
         SET branch_id = (
           SELECT a.branch_id
             FROM in_patient_admissions a
            WHERE a.id = in_patient_sessions.admission_id
         )
       WHERE (branch_id IS NULL OR branch_id = '')
         AND EXISTS (
           SELECT 1
             FROM in_patient_admissions a
            WHERE a.id = in_patient_sessions.admission_id
              AND a.branch_id IS NOT NULL
              AND a.branch_id != ''
         )`,
    );
  } catch (error: unknown) {
    const msg = String((error as Error)?.message ?? "");
    // Tolerate environments where the tables/columns don't yet exist.
    if (msg.includes("no such table") || msg.includes("does not exist") || msg.includes("no such column")) {
      return;
    }
    throw error;
  }
}
