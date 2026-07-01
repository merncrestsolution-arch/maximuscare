/**
 * Part 11 — document storage metadata + appointment status/reminders.
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

async function addColumn(table: string, column: string, ddl: string) {
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  } catch (error: any) {
    const msg = String(error?.message ?? "");
    if (msg.includes("duplicate column") || msg.includes("already exists")) return;
    throw error;
  }
}

export async function runPart11DocumentsAppointmentsMigration() {
  if (usePostgres) {
    await addColumn("patient_documents", "storage_key", "TEXT");
    await addColumn("patient_documents", "mime_type", "TEXT");
    await addColumn("patient_documents", "file_size", "INTEGER");
    await addColumn("appointments", "status", "TEXT NOT NULL DEFAULT 'Scheduled'");
    await addColumn("appointments", "branch", "TEXT");
    await addColumn("appointments", "reminder_sent", "INTEGER NOT NULL DEFAULT 0");
  } else {
    await addColumn("patient_documents", "storage_key", "TEXT");
    await addColumn("patient_documents", "mime_type", "TEXT");
    await addColumn("patient_documents", "file_size", "INTEGER");
    await addColumn("appointments", "status", "TEXT NOT NULL DEFAULT 'Scheduled'");
    await addColumn("appointments", "branch", "TEXT");
    await addColumn("appointments", "reminder_sent", "INTEGER NOT NULL DEFAULT 0");
  }
}
