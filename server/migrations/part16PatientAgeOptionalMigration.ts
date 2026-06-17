/**
 * Part 16 — make patients.age nullable (optional field).
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

export async function runPart16PatientAgeOptionalMigration() {
  if (usePostgres) {
    try {
      await run(`ALTER TABLE patients ALTER COLUMN age DROP NOT NULL`);
    } catch (error: unknown) {
      const msg = String((error as Error)?.message ?? "");
      if (!msg.includes("does not exist") && !msg.includes("already")) throw error;
    }
    return;
  }

  // SQLite: rebuild patients table so age can be NULL
  try {
    await run(`PRAGMA foreign_keys=OFF`);
    await run(`BEGIN TRANSACTION`);

    await run(`
      CREATE TABLE IF NOT EXISTS patients_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        age INTEGER,
        gender TEXT NOT NULL,
        address TEXT NOT NULL,
        registered_date TEXT NOT NULL,
        branch TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        default_visit_type TEXT NOT NULL,
        condition TEXT,
        patient_code TEXT,
        full_name TEXT,
        therapist_first_visit_id TEXT,
        first_visit_date TEXT,
        branch_id TEXT,
        date_of_birth TEXT,
        nic_or_passport TEXT,
        emergency_contact TEXT,
        referral_source TEXT,
        photo_uri TEXT,
        deleted_at INTEGER,
        deleted_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await run(`
      INSERT INTO patients_new (
        id, name, phone, age, gender, address, registered_date, branch, status,
        default_visit_type, condition, patient_code, full_name, therapist_first_visit_id,
        first_visit_date, branch_id, date_of_birth, nic_or_passport, emergency_contact,
        referral_source, photo_uri, deleted_at, deleted_by, created_at, updated_at
      )
      SELECT
        id, name, phone, age, gender, address, registered_date, branch, status,
        default_visit_type, condition, patient_code, full_name, therapist_first_visit_id,
        first_visit_date, branch_id, date_of_birth, nic_or_passport, emergency_contact,
        referral_source, photo_uri, deleted_at, deleted_by, created_at, updated_at
      FROM patients
    `);

    await run(`DROP TABLE patients`);
    await run(`ALTER TABLE patients_new RENAME TO patients`);
    await run(`COMMIT`);
    await run(`PRAGMA foreign_keys=ON`);
  } catch (error: unknown) {
    const msg = String((error as Error)?.message ?? "");
    if (msg.includes("patients_new") && msg.includes("already exists")) {
      try {
        await run(`DROP TABLE IF EXISTS patients_new`);
      } catch {
        /* ignore */
      }
    }
    if (!msg.includes("no such table: patients")) throw error;
  }
}
