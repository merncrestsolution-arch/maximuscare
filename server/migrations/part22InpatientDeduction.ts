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

/**
 * Bug 3: In-Patient bill deductions. Adds the deduction columns to in_patient_admissions
 * so a fixed-amount or percentage discount can be applied against the bill subtotal,
 * with an audit trail of who applied it and when.
 */
export async function runPart22InpatientDeduction() {
  if (usePostgres) {
    await addColumn("in_patient_admissions", "deduction_type", "TEXT");
    await addColumn("in_patient_admissions", "deduction_value", "DECIMAL(12,2) NOT NULL DEFAULT '0'");
    await addColumn("in_patient_admissions", "deduction_reason", "TEXT");
    await addColumn("in_patient_admissions", "deduction_applied_by", "TEXT");
    await addColumn("in_patient_admissions", "deduction_applied_by_id", "TEXT");
    await addColumn("in_patient_admissions", "deduction_applied_at", "TIMESTAMP");
    await addColumn("in_patient_discharges", "deduction_type", "TEXT");
    await addColumn("in_patient_discharges", "deduction_value", "DECIMAL(12,2) NOT NULL DEFAULT '0'");
    await addColumn("in_patient_discharges", "deduction_amount", "DECIMAL(12,2) NOT NULL DEFAULT '0'");
    await addColumn("in_patient_discharges", "deduction_reason", "TEXT");
  } else {
    await addColumn("in_patient_admissions", "deduction_type", "TEXT");
    await addColumn("in_patient_admissions", "deduction_value", "TEXT NOT NULL DEFAULT '0'");
    await addColumn("in_patient_admissions", "deduction_reason", "TEXT");
    await addColumn("in_patient_admissions", "deduction_applied_by", "TEXT");
    await addColumn("in_patient_admissions", "deduction_applied_by_id", "TEXT");
    await addColumn("in_patient_admissions", "deduction_applied_at", "INTEGER");
    await addColumn("in_patient_discharges", "deduction_type", "TEXT");
    await addColumn("in_patient_discharges", "deduction_value", "TEXT NOT NULL DEFAULT '0'");
    await addColumn("in_patient_discharges", "deduction_amount", "TEXT NOT NULL DEFAULT '0'");
    await addColumn("in_patient_discharges", "deduction_reason", "TEXT");
  }
}
