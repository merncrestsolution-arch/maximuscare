/**
 * Part 19 — patient_transfer_logs table (Bug 4).
 * Records each in-patient branch transfer (from/to branch, date, note, who did it)
 * without re-scoping historical sessions/bills.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";

const usePostgres = !!process.env.DATABASE_URL?.startsWith("postgres");

async function run(statement: string) {
  const query = sql.raw(statement);
  if (usePostgres) {
    await (db as { execute: (q: ReturnType<typeof sql.raw>) => Promise<unknown> }).execute(query);
  } else {
    await db.run(query);
  }
}

export async function runPart19PatientTransferLogs() {
  if (usePostgres) {
    await run(`CREATE TABLE IF NOT EXISTS patient_transfer_logs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id VARCHAR NOT NULL,
      patient_name TEXT,
      from_branch_id TEXT,
      to_branch_id TEXT NOT NULL,
      transfer_date DATE NOT NULL,
      transfer_note TEXT,
      transferred_by_staff_id VARCHAR,
      transferred_by_name TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )`);
  } else {
    await run(`CREATE TABLE IF NOT EXISTS patient_transfer_logs (
      id TEXT PRIMARY KEY,
      admission_id TEXT NOT NULL,
      patient_name TEXT,
      from_branch_id TEXT,
      to_branch_id TEXT NOT NULL,
      transfer_date TEXT NOT NULL,
      transfer_note TEXT,
      transferred_by_staff_id TEXT,
      transferred_by_name TEXT,
      created_at INTEGER NOT NULL
    )`);
  }
  try {
    await run("CREATE INDEX IF NOT EXISTS idx_transfer_logs_admission ON patient_transfer_logs(admission_id)");
  } catch {
    /* optional */
  }
}
