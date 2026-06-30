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
 * Adds in_patient_admissions.admission_source so an admission created by converting
 * an existing out-patient ("out_patient_transfer") can be distinguished from a fresh
 * admission for audit/reporting purposes.
 */
export async function runPart24AdmissionSource() {
  await addColumn("in_patient_admissions", "admission_source", "TEXT");
}
