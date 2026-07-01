/**
 * Part 8 — performance indexes, session tracking, system logs, password reset tokens.
 */
import { sql } from "drizzle-orm";
import { migrationUsePostgres } from "./pgDetect";
import { db } from "../db";

const usePostgres = migrationUsePostgres();

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

async function createIndex(name: string, ddl: string) {
  try {
    await run(ddl);
  } catch {
    /* index may exist */
  }
}

export async function runPart8SchemaMigration() {
  // ── auth_sessions session tracking ──
  await addColumn("auth_sessions", "ip_address", "TEXT");
  await addColumn("auth_sessions", "user_agent", "TEXT");
  await addColumn("auth_sessions", "last_activity_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("auth_sessions", "remember_me", usePostgres ? "INTEGER NOT NULL DEFAULT 0" : "INTEGER NOT NULL DEFAULT 0");

  const passwordResetDdl = usePostgres
    ? `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id VARCHAR NOT NULL REFERENCES staff(id),
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    : `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL REFERENCES staff(id),
        token_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        created_at INTEGER NOT NULL
      )`;

  const systemLogsDdl = usePostgres
    ? `CREATE TABLE IF NOT EXISTS system_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        level TEXT NOT NULL DEFAULT 'info',
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        user_id TEXT,
        ip_address TEXT,
        action TEXT,
        stack_trace TEXT,
        metadata TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    : `CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL DEFAULT 'info',
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        user_id TEXT,
        ip_address TEXT,
        action TEXT,
        stack_trace TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL
      )`;

  await run(passwordResetDdl);
  await run(systemLogsDdl);

  // ── performance indexes ──
  const indexes = [
    ["idx_patients_name", "CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name)"],
    ["idx_patients_phone", "CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone)"],
    ["idx_attendance_date", "CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)"],
    ["idx_visits_visit_date", "CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date)"],
    ["idx_visits_branch", "CREATE INDEX IF NOT EXISTS idx_visits_branch ON visits(branch)"],
    ["idx_staff_branch", "CREATE INDEX IF NOT EXISTS idx_staff_branch ON staff(branch)"],
    ["idx_salaries_month", "CREATE INDEX IF NOT EXISTS idx_salaries_month ON salaries(salary_month)"],
    ["idx_tasks_due_date", "CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)"],
    ["idx_notifications_staff", "CREATE INDEX IF NOT EXISTS idx_notifications_staff ON notifications(staff_id)"],
    ["idx_auth_sessions_staff", "CREATE INDEX IF NOT EXISTS idx_auth_sessions_staff ON auth_sessions(staff_id)"],
    ["idx_audit_logs_module", "CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module)"],
  ];
  for (const [, ddl] of indexes) {
    await createIndex("", ddl);
  }
}
