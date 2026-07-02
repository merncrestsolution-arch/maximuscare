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

async function addColumn(table: string, column: string, definition: string) {
  try {
    if (usePostgres) {
      await run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    } else {
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (error: unknown) {
    const msg = String((error as Error)?.message ?? "");
    if (msg.includes("duplicate column") || msg.includes("already exists")) return;
    throw error;
  }
}

/** Current branch-stay deduction fields (separate from prior-segment deduction after transfer). */
export async function runPart33CurrentSegmentDeduction() {
  if (usePostgres) {
    await addColumn("in_patient_admissions", "current_deduction_type", "TEXT");
    await addColumn("in_patient_admissions", "current_deduction_value", "DECIMAL(12,2) NOT NULL DEFAULT '0'");
    await addColumn("in_patient_admissions", "current_deduction_reason", "TEXT");
    await addColumn("in_patient_admissions", "current_deduction_applied_by", "TEXT");
    await addColumn("in_patient_admissions", "current_deduction_applied_by_id", "TEXT");
    await addColumn("in_patient_admissions", "current_deduction_applied_at", "TIMESTAMP");
  } else {
    await addColumn("in_patient_admissions", "current_deduction_type", "TEXT");
    await addColumn("in_patient_admissions", "current_deduction_value", "TEXT NOT NULL DEFAULT '0'");
    await addColumn("in_patient_admissions", "current_deduction_reason", "TEXT");
    await addColumn("in_patient_admissions", "current_deduction_applied_by", "TEXT");
    await addColumn("in_patient_admissions", "current_deduction_applied_by_id", "TEXT");
    await addColumn("in_patient_admissions", "current_deduction_applied_at", "INTEGER");
  }
}
