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

export async function runPart21SalaryAdjustments() {
  if (usePostgres) {
    await run(`CREATE TABLE IF NOT EXISTS staff_salary_adjustments (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id VARCHAR NOT NULL,
      staff_name TEXT NOT NULL,
      type TEXT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      adjustment_date DATE NOT NULL,
      reason TEXT NOT NULL,
      created_by_staff_id VARCHAR,
      created_by_name TEXT,
      deleted_at TIMESTAMP,
      deleted_by VARCHAR,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )`);
  } else {
    await run(`CREATE TABLE IF NOT EXISTS staff_salary_adjustments (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      type TEXT NOT NULL,
      amount TEXT NOT NULL,
      adjustment_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_by_staff_id TEXT,
      created_by_name TEXT,
      deleted_at INTEGER,
      deleted_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
  }
}
