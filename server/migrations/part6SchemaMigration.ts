/**
 * Part 6 — patient management, visit payments, documents, notes, home visits.
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

export async function runPart6SchemaMigration() {
  // ── patients ──
  await addColumn("patients", "date_of_birth", usePostgres ? "DATE" : "TEXT");
  await addColumn("patients", "nic_or_passport", "TEXT");
  await addColumn("patients", "emergency_contact", "TEXT");
  await addColumn("patients", "referral_source", "TEXT");
  await addColumn("patients", "photo_uri", "TEXT");

  // ── visits ──
  await addColumn("visits", "amount_paid", usePostgres ? "DECIMAL(12,2) NOT NULL DEFAULT 0" : "TEXT NOT NULL DEFAULT '0'");
  await addColumn("visits", "visit_status", "TEXT NOT NULL DEFAULT 'Completed'");
  await addColumn("visits", "home_visit_type", "TEXT");

  // ── home_visits enhancements ──
  await addColumn("home_visits", "staff_name", "TEXT");
  await addColumn("home_visits", "patient_name", "TEXT");
  await addColumn("home_visits", "visit_date", usePostgres ? "DATE" : "TEXT");
  await addColumn("home_visits", "visit_date_ts", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("home_visits", "branch", "TEXT");
  await addColumn("home_visits", "notes", "TEXT");
  await addColumn("home_visits", "visit_id", "TEXT");
  await addColumn("home_visits", "deleted_at", usePostgres ? "TIMESTAMP" : "INTEGER");

  const visitPaymentsDdl = usePostgres
    ? `CREATE TABLE IF NOT EXISTS visit_payments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        visit_id VARCHAR NOT NULL REFERENCES visits(id),
        amount DECIMAL(12,2) NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'Cash',
        payment_reference TEXT,
        payment_date DATE NOT NULL,
        remarks TEXT,
        created_by_staff_id VARCHAR,
        created_by_name TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    : `CREATE TABLE IF NOT EXISTS visit_payments (
        id TEXT PRIMARY KEY,
        visit_id TEXT NOT NULL REFERENCES visits(id),
        amount TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'Cash',
        payment_reference TEXT,
        payment_date TEXT NOT NULL,
        remarks TEXT,
        created_by_staff_id TEXT,
        created_by_name TEXT,
        deleted_at INTEGER,
        created_at INTEGER NOT NULL
      )`;

  const patientDocumentsDdl = usePostgres
    ? `CREATE TABLE IF NOT EXISTS patient_documents (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id VARCHAR NOT NULL REFERENCES patients(id),
        file_name TEXT NOT NULL,
        document_type TEXT NOT NULL,
        file_uri TEXT NOT NULL,
        uploaded_by_staff_id VARCHAR,
        uploaded_by_name TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    : `CREATE TABLE IF NOT EXISTS patient_documents (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        file_name TEXT NOT NULL,
        document_type TEXT NOT NULL,
        file_uri TEXT NOT NULL,
        uploaded_by_staff_id TEXT,
        uploaded_by_name TEXT,
        deleted_at INTEGER,
        created_at INTEGER NOT NULL
      )`;

  const patientNotesDdl = usePostgres
    ? `CREATE TABLE IF NOT EXISTS patient_notes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id VARCHAR NOT NULL REFERENCES patients(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        created_by_staff_id VARCHAR,
        created_by_name TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    : `CREATE TABLE IF NOT EXISTS patient_notes (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        created_by_staff_id TEXT,
        created_by_name TEXT,
        deleted_at INTEGER,
        created_at INTEGER NOT NULL
      )`;

  try {
    await run(visitPaymentsDdl);
    await run(patientDocumentsDdl);
    await run(patientNotesDdl);
    await run("CREATE INDEX IF NOT EXISTS idx_visit_payments_visit ON visit_payments(visit_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_patient_documents_patient ON patient_documents(patient_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_patient_notes_patient ON patient_notes(patient_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone)");
    await run("CREATE INDEX IF NOT EXISTS idx_patients_code ON patients(patient_code)");
  } catch {
    /* tables may exist */
  }
}
