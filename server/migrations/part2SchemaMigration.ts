/**
 * Part 2 — additive schema migration (no table drops, no data deletion).
 * IDs remain TEXT/UUID for backward compatibility with the running application.
 * Spec BIGINT fields are stored as TEXT references to existing primary keys.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";

const usePostgres = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || "");

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

async function createIndex(name: string, statement: string) {
  try {
    await run(statement);
  } catch {
    /* index may already exist */
  }
}

export async function runPart2SchemaMigration() {
  // ── staff ──
  await addColumn("staff", "joining_date", usePostgres ? "DATE" : "TEXT");
  await addColumn("staff", "profile_photo", "TEXT");
  await addColumn("staff", "deactivated_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("staff", "deactivated_by", "TEXT");
  await addColumn("staff", "deleted_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("staff", "deleted_by", "TEXT");

  // ── patients ──
  await addColumn("patients", "patient_code", "TEXT");
  await addColumn("patients", "full_name", "TEXT");
  await addColumn("patients", "therapist_first_visit_id", "TEXT");
  await addColumn("patients", "first_visit_date", usePostgres ? "DATE" : "TEXT");
  await addColumn("patients", "branch_id", "TEXT");
  await addColumn("patients", "deleted_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("patients", "deleted_by", "TEXT");
  await addColumn("patients", "data_version", usePostgres ? "INTEGER NOT NULL DEFAULT 2" : "INTEGER NOT NULL DEFAULT 2");
  await addColumn("patients", "data_migrated_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("patients", "qr_token", "TEXT");
  await addColumn("patients", "qr_token_expires_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("patients", "id_card_pdf_key", "TEXT");
  await addColumn("patients", "id_card_qr_token", "TEXT");
  await addColumn("patients", "id_card_generated_at", usePostgres ? "TIMESTAMP" : "INTEGER");

  // ── visits (patient_visits) ──
  await addColumn("visits", "branch_id", "TEXT");
  await addColumn("visits", "deleted_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("visits", "deleted_by", "TEXT");

  // ── attendance ──
  await addColumn("attendance", "attendance_date", usePostgres ? "DATE" : "TEXT");
  await addColumn("attendance", "remarks", "TEXT");
  await addColumn("attendance", "edited_by", "TEXT");
  await addColumn("attendance", "edited_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("attendance", "edit_reason", "TEXT");
  await addColumn("attendance", "deleted_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("attendance", "deleted_by", "TEXT");

  // ── in_patient_sessions (inpatient_sessions) ──
  await addColumn("in_patient_sessions", "patient_id", "TEXT");
  await addColumn("in_patient_sessions", "branch_id", "TEXT");
  await addColumn("in_patient_sessions", "notes", "TEXT");

  // ── in_patient_admissions — link admissions to the patient master + reused Patient ID ──
  await addColumn("in_patient_admissions", "patient_id", "TEXT");
  await addColumn("in_patient_admissions", "patient_code", "TEXT");

  // ── branches ──
  await addColumn("branches", "branch_name", "TEXT");
  await addColumn("branches", "address", "TEXT");

  // ── staff_fines (fines) ──
  await addColumn("staff_fines", "updated_by_staff_id", "TEXT");
  await addColumn("staff_fines", "deleted_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("staff_fines", "deleted_by", "TEXT");

  // ── expenses (staff_expenses) ──
  await addColumn("expenses", "staff_id", "TEXT");
  await addColumn("expenses", "remarks", "TEXT");
  await addColumn("expenses", "deleted_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("expenses", "deleted_by", "TEXT");

  // ── tasks ──
  await addColumn("tasks", "task_type", "TEXT DEFAULT 'Individual'");
  await addColumn("tasks", "assigned_by", "TEXT");
  await addColumn("tasks", "deleted_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("tasks", "deleted_by", "TEXT");

  // ── notifications ──
  await addColumn("notifications", "user_id", "TEXT");
  await addColumn("notifications", "sent_at", usePostgres ? "TIMESTAMP" : "INTEGER");

  // ── audit_logs (universal audit) ──
  await addColumn("audit_logs", "module", "TEXT");
  await addColumn("audit_logs", "record_id", "TEXT");
  await addColumn("audit_logs", "old_values", usePostgres ? "JSONB" : "TEXT");
  await addColumn("audit_logs", "new_values", usePostgres ? "JSONB" : "TEXT");

  // ── new tables ──
  if (usePostgres) {
    await run(`
      CREATE TABLE IF NOT EXISTS home_visits (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id VARCHAR NOT NULL REFERENCES staff(id),
        patient_id VARCHAR REFERENCES patients(id),
        visit_type VARCHAR NOT NULL,
        visit_date TIMESTAMP NOT NULL,
        payment_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
    await run(`
      CREATE TABLE IF NOT EXISTS salaries (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id VARCHAR NOT NULL REFERENCES staff(id),
        salary_month DATE NOT NULL,
        basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
        incentive_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        home_visit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        ot_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        fines_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        deductions_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        final_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
        deleted_at TIMESTAMP,
        deleted_by VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
    await run(`
      CREATE TABLE IF NOT EXISTS staff_incentives (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id VARCHAR NOT NULL REFERENCES staff(id),
        incentive_date DATE NOT NULL,
        clinic_visits INTEGER NOT NULL DEFAULT 0,
        inpatient_sessions INTEGER NOT NULL DEFAULT 0,
        incentive_count INTEGER NOT NULL DEFAULT 0,
        incentive_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
    await run(`
      CREATE TABLE IF NOT EXISTS task_assignments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id VARCHAR NOT NULL REFERENCES tasks(id),
        staff_id VARCHAR NOT NULL REFERENCES staff(id),
        status VARCHAR NOT NULL DEFAULT 'Pending',
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
  } else {
    await run(`
      CREATE TABLE IF NOT EXISTS home_visits (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL REFERENCES staff(id),
        patient_id TEXT REFERENCES patients(id),
        visit_type TEXT NOT NULL,
        visit_date INTEGER NOT NULL,
        payment_amount TEXT NOT NULL DEFAULT '0',
        created_at INTEGER NOT NULL
      )`);
    await run(`
      CREATE TABLE IF NOT EXISTS salaries (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL REFERENCES staff(id),
        salary_month TEXT NOT NULL,
        basic_salary TEXT NOT NULL DEFAULT '0',
        incentive_amount TEXT NOT NULL DEFAULT '0',
        home_visit_amount TEXT NOT NULL DEFAULT '0',
        ot_amount TEXT NOT NULL DEFAULT '0',
        fines_total TEXT NOT NULL DEFAULT '0',
        deductions_total TEXT NOT NULL DEFAULT '0',
        final_salary TEXT NOT NULL DEFAULT '0',
        deleted_at INTEGER,
        deleted_by TEXT,
        created_at INTEGER NOT NULL
      )`);
    await run(`
      CREATE TABLE IF NOT EXISTS staff_incentives (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL REFERENCES staff(id),
        incentive_date TEXT NOT NULL,
        clinic_visits INTEGER NOT NULL DEFAULT 0,
        inpatient_sessions INTEGER NOT NULL DEFAULT 0,
        incentive_count INTEGER NOT NULL DEFAULT 0,
        incentive_amount TEXT NOT NULL DEFAULT '0',
        created_at INTEGER NOT NULL
      )`);
    await run(`
      CREATE TABLE IF NOT EXISTS task_assignments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        staff_id TEXT NOT NULL REFERENCES staff(id),
        status TEXT NOT NULL DEFAULT 'Pending',
        completed_at INTEGER,
        created_at INTEGER NOT NULL
      )`);
  }

  // ── data backfill (preserve existing records) ──
  await run(`UPDATE staff SET profile_photo = photo_uri WHERE profile_photo IS NULL AND photo_uri IS NOT NULL`);
  if (usePostgres) {
    await run(`UPDATE staff SET joining_date = created_at::date WHERE joining_date IS NULL`);
  } else {
    await run(
      `UPDATE staff SET joining_date = strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') WHERE joining_date IS NULL`
    );
  }

  await run(`UPDATE patients SET full_name = name WHERE full_name IS NULL`);
  await run(`UPDATE patients SET first_visit_date = registered_date WHERE first_visit_date IS NULL`);

  await run(`UPDATE attendance SET attendance_date = date WHERE attendance_date IS NULL`);
  await run(`UPDATE attendance SET remarks = notes WHERE remarks IS NULL AND notes IS NOT NULL`);

  await run(`UPDATE branches SET branch_name = name WHERE branch_name IS NULL`);

  await run(`UPDATE expenses SET staff_id = created_by_staff_id WHERE staff_id IS NULL`);
  await run(`UPDATE expenses SET remarks = description WHERE remarks IS NULL AND description IS NOT NULL`);

  await run(`UPDATE tasks SET assigned_by = created_by_staff_id WHERE assigned_by IS NULL`);
  await run(`UPDATE tasks SET task_type = 'Individual' WHERE task_type IS NULL`);

  await run(`UPDATE notifications SET user_id = staff_id WHERE user_id IS NULL`);
  if (usePostgres) {
    await run(`UPDATE notifications SET sent_at = created_at WHERE sent_at IS NULL`);
  } else {
    await run(`UPDATE notifications SET sent_at = created_at WHERE sent_at IS NULL`);
  }

  await run(`UPDATE audit_logs SET module = entity_type WHERE module IS NULL`);
  await run(`UPDATE audit_logs SET record_id = entity_id WHERE record_id IS NULL`);
  await run(`UPDATE audit_logs SET old_values = old_value WHERE old_values IS NULL AND old_value IS NOT NULL`);
  await run(`UPDATE audit_logs SET new_values = new_value WHERE new_values IS NULL AND new_value IS NOT NULL`);

  // Link branch_id from branch name where possible
  if (usePostgres) {
    await run(`
      UPDATE patients p SET branch_id = b.id
      FROM branches b WHERE p.branch_id IS NULL AND LOWER(p.branch) = LOWER(b.name)`);
    await run(`
      UPDATE visits v SET branch_id = b.id
      FROM branches b WHERE v.branch_id IS NULL AND LOWER(v.branch) = LOWER(b.name)`);
  } else {
    await run(`
      UPDATE patients SET branch_id = (
        SELECT id FROM branches WHERE LOWER(name) = LOWER(patients.branch) LIMIT 1
      ) WHERE branch_id IS NULL`);
    await run(`
      UPDATE visits SET branch_id = (
        SELECT id FROM branches WHERE LOWER(name) = LOWER(visits.branch) LIMIT 1
      ) WHERE branch_id IS NULL`);
  }

  // Therapist first visit from earliest visit per patient
  if (usePostgres) {
    await run(`
      UPDATE patients p SET therapist_first_visit_id = sub.treating_staff_id,
        first_visit_date = sub.visit_date
      FROM (
        SELECT DISTINCT ON (patient_id) patient_id, treating_staff_id, visit_date
        FROM visits WHERE deleted_at IS NULL ORDER BY patient_id, visit_date ASC
      ) sub WHERE p.id = sub.patient_id AND p.therapist_first_visit_id IS NULL`);
  } else {
    await run(`
      UPDATE patients SET therapist_first_visit_id = (
        SELECT treating_staff_id FROM visits v
        WHERE v.patient_id = patients.id AND (v.deleted_at IS NULL OR v.deleted_at = '')
        ORDER BY v.visit_date ASC LIMIT 1
      ) WHERE therapist_first_visit_id IS NULL`);
    await run(`
      UPDATE patients SET first_visit_date = (
        SELECT visit_date FROM visits v
        WHERE v.patient_id = patients.id AND (v.deleted_at IS NULL OR v.deleted_at = '')
        ORDER BY v.visit_date ASC LIMIT 1
      ) WHERE first_visit_date IS NULL`);
  }

  // Backfill home_visits from existing Home visits (idempotent)
  if (usePostgres) {
    await run(`
      INSERT INTO home_visits (id, staff_id, patient_id, visit_type, visit_date, payment_amount, created_at)
      SELECT gen_random_uuid(), v.treating_staff_id, v.patient_id,
        CASE WHEN v.branch = 'Bandaragama' THEN 'Bandaragama' ELSE 'Colombo' END,
        (v.visit_date::text || ' ' || v.start_time)::timestamp,
        COALESCE(v.payment_amount, 0), NOW()
      FROM visits v
      WHERE v.visit_type = 'Home' AND v.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM home_visits h
          WHERE h.staff_id = v.treating_staff_id AND h.patient_id = v.patient_id
            AND h.visit_date::date = v.visit_date::date
        )`);
  } else {
    await run(`
      INSERT INTO home_visits (id, staff_id, patient_id, visit_type, visit_date, payment_amount, created_at)
      SELECT lower(hex(randomblob(16))), v.treating_staff_id, v.patient_id,
        CASE WHEN v.branch = 'Bandaragama' THEN 'Bandaragama' ELSE 'Colombo' END,
        strftime('%s', v.visit_date || ' ' || v.start_time), v.payment_amount, strftime('%s','now')
      FROM visits v
      WHERE v.visit_type = 'Home' AND (v.deleted_at IS NULL OR v.deleted_at = '')
        AND NOT EXISTS (
          SELECT 1 FROM home_visits h
          WHERE h.staff_id = v.treating_staff_id AND h.patient_id = v.patient_id
            AND date(h.visit_date, 'unixepoch') = v.visit_date
        )`);
  }

  // Migrate existing tasks into task_assignments
  if (usePostgres) {
    await run(`
      INSERT INTO task_assignments (id, task_id, staff_id, status, completed_at, created_at)
      SELECT gen_random_uuid(), t.id, t.assigned_to_staff_id,
        CASE WHEN t.status = 'completed' THEN 'Completed' WHEN t.status = 'in_progress' THEN 'In Progress' ELSE 'Pending' END,
        CASE WHEN t.status = 'completed' THEN t.updated_at ELSE NULL END, t.created_at
      FROM tasks t
      WHERE NOT EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.staff_id = t.assigned_to_staff_id)`);
  } else {
    await run(`
      INSERT INTO task_assignments (id, task_id, staff_id, status, completed_at, created_at)
      SELECT lower(hex(randomblob(16))), t.id, t.assigned_to_staff_id,
        CASE WHEN t.status = 'completed' THEN 'Completed' WHEN t.status = 'in_progress' THEN 'In Progress' ELSE 'Pending' END,
        CASE WHEN t.status = 'completed' THEN t.updated_at ELSE NULL END, t.created_at
      FROM tasks t
      WHERE NOT EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.staff_id = t.assigned_to_staff_id)`);
  }

  // ── indexes ──
  await createIndex("idx_patients_full_name", "CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients(full_name)");
  await createIndex("idx_visits_patient_id", "CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id)");
  await createIndex("idx_visits_branch_id", "CREATE INDEX IF NOT EXISTS idx_visits_branch_id ON visits(branch_id)");
  await createIndex("idx_visits_visit_date", "CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date)");
  await createIndex("idx_attendance_staff_id", "CREATE INDEX IF NOT EXISTS idx_attendance_staff_id ON attendance(staff_id)");
  await createIndex("idx_attendance_attendance_date", "CREATE INDEX IF NOT EXISTS idx_attendance_attendance_date ON attendance(attendance_date)");
  await createIndex("idx_salaries_staff_id", "CREATE INDEX IF NOT EXISTS idx_salaries_staff_id ON salaries(staff_id)");
  await createIndex("idx_tasks_due_date", "CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)");
  await createIndex("idx_notifications_user_id", "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)");

  console.log("[MIGRATION] Part 2 schema migration completed");
}
