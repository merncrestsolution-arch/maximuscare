/**
 * Part 5 — salary workflow, deductions, OT entries, fine enhancements.
 * Additive only; no table drops.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";

const usePostgres = !!process.env.DATABASE_URL?.startsWith("postgresql");

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

async function createTableIfNotExists(name: string, ddl: string) {
  try {
    await run(ddl);
  } catch (error: unknown) {
    const msg = String((error as Error)?.message ?? "");
    if (msg.includes("already exists")) return;
    throw error;
  }
}

export async function runPart5SchemaMigration() {
  // ── staff_fines enhancements ──
  await addColumn("staff_fines", "fine_type", "TEXT NOT NULL DEFAULT 'Manual Fine'");
  await addColumn("staff_fines", "remarks", "TEXT");
  await addColumn("staff_fines", "status", "TEXT NOT NULL DEFAULT 'active'");

  // ── salaries workflow ──
  await addColumn("salaries", "staff_name", "TEXT");
  await addColumn("salaries", "period_start", usePostgres ? "DATE" : "TEXT");
  await addColumn("salaries", "period_end", usePostgres ? "DATE" : "TEXT");
  await addColumn("salaries", "extra_holiday_deduction", usePostgres ? "DECIMAL(12,2) NOT NULL DEFAULT 0" : "TEXT NOT NULL DEFAULT '0'");
  await addColumn("salaries", "other_deductions", usePostgres ? "DECIMAL(12,2) NOT NULL DEFAULT 0" : "TEXT NOT NULL DEFAULT '0'");
  await addColumn("salaries", "status", "TEXT NOT NULL DEFAULT 'Generated'");
  await addColumn("salaries", "breakdown", "TEXT");
  await addColumn("salaries", "generated_by_staff_id", "TEXT");
  await addColumn("salaries", "generated_by_name", "TEXT");
  await addColumn("salaries", "approved_by_staff_id", "TEXT");
  await addColumn("salaries", "approved_by_name", "TEXT");
  await addColumn("salaries", "approved_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("salaries", "paid_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("salaries", "payment_method", "TEXT");
  await addColumn("salaries", "payment_reference", "TEXT");
  await addColumn("salaries", "paid_by_staff_id", "TEXT");
  await addColumn("salaries", "payment_remarks", "TEXT");
  await addColumn("salaries", "rejected_reason", "TEXT");
  await addColumn("salaries", "updated_at", usePostgres ? "TIMESTAMP DEFAULT NOW()" : "INTEGER");

  // ── staff_deductions ──
  if (usePostgres) {
    await createTableIfNotExists(
      "staff_deductions",
      `CREATE TABLE IF NOT EXISTS staff_deductions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id VARCHAR NOT NULL REFERENCES staff(id),
        staff_name TEXT NOT NULL,
        category TEXT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        deduction_date DATE NOT NULL,
        remarks TEXT,
        created_by_staff_id VARCHAR,
        created_by_name TEXT,
        deleted_at TIMESTAMP,
        deleted_by VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    );
    await createTableIfNotExists(
      "staff_ot_entries",
      `CREATE TABLE IF NOT EXISTS staff_ot_entries (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id VARCHAR NOT NULL REFERENCES staff(id),
        staff_name TEXT NOT NULL,
        ot_date DATE NOT NULL,
        hours DECIMAL(6,2) NOT NULL,
        reason TEXT,
        approved_by_staff_id VARCHAR,
        approved_by_name TEXT,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        deleted_at TIMESTAMP,
        deleted_by VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    );
  } else {
    await createTableIfNotExists(
      "staff_deductions",
      `CREATE TABLE IF NOT EXISTS staff_deductions (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL REFERENCES staff(id),
        staff_name TEXT NOT NULL,
        category TEXT NOT NULL,
        amount TEXT NOT NULL,
        deduction_date TEXT NOT NULL,
        remarks TEXT,
        created_by_staff_id TEXT,
        created_by_name TEXT,
        deleted_at INTEGER,
        deleted_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    );
    await createTableIfNotExists(
      "staff_ot_entries",
      `CREATE TABLE IF NOT EXISTS staff_ot_entries (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL REFERENCES staff(id),
        staff_name TEXT NOT NULL,
        ot_date TEXT NOT NULL,
        hours TEXT NOT NULL,
        reason TEXT,
        approved_by_staff_id TEXT,
        approved_by_name TEXT,
        amount TEXT NOT NULL DEFAULT '0',
        deleted_at INTEGER,
        deleted_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    );
  }

  try {
    await run("CREATE INDEX IF NOT EXISTS idx_salaries_staff_month ON salaries(staff_id, salary_month)");
    await run("CREATE INDEX IF NOT EXISTS idx_salaries_status ON salaries(status)");
    await run("CREATE INDEX IF NOT EXISTS idx_staff_deductions_staff_date ON staff_deductions(staff_id, deduction_date)");
    await run("CREATE INDEX IF NOT EXISTS idx_staff_ot_staff_date ON staff_ot_entries(staff_id, ot_date)");
  } catch {
    /* indexes optional */
  }
}
