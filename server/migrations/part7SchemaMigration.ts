/**
 * Part 7 — HRM: staff codes, notification archive, task completion, audit IP.
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

export async function runPart7SchemaMigration() {
  // ── staff ──
  await addColumn("staff", "employee_code", "TEXT");
  await addColumn("staff", "designation", "TEXT");

  // ── notifications ──
  await addColumn("notifications", "is_archived", usePostgres ? "INTEGER NOT NULL DEFAULT 0" : "INTEGER NOT NULL DEFAULT 0");
  await addColumn("notifications", "read_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("notifications", "deleted_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("notifications", "deleted_by", "TEXT");

  // ── tasks ──
  await addColumn("tasks", "completion_notes", "TEXT");
  await addColumn("tasks", "completion_files", "TEXT");
  await addColumn("tasks", "remarks", "TEXT");
  await addColumn("tasks", "reminder_sent_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("tasks", "overdue_notified_at", usePostgres ? "TIMESTAMP" : "INTEGER");

  // ── audit_logs ──
  await addColumn("audit_logs", "ip_address", "TEXT");

}
