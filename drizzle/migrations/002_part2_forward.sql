-- Part 2 FORWARD migration (PostgreSQL)
-- Safe to re-run: uses IF NOT EXISTS / IF NOT EXISTS columns
-- IDs remain VARCHAR/UUID for backward compatibility with existing application data.
-- Spec BIGINT references are stored as VARCHAR foreign keys.

-- Backup reminder: pg_dump your database before applying in production.

BEGIN;

-- staff enhancements
ALTER TABLE staff ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deactivated_by VARCHAR;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_by VARCHAR;

-- patients enhancements
ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_code VARCHAR;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS full_name VARCHAR;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS therapist_first_visit_id VARCHAR;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_visit_date DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS branch_id VARCHAR;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_by VARCHAR;

-- visits (patient_visits) enhancements
ALTER TABLE visits ADD COLUMN IF NOT EXISTS branch_id VARCHAR;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS deleted_by VARCHAR;

-- attendance enhancements
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS attendance_date DATE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS edited_by VARCHAR;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS edit_reason TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS deleted_by VARCHAR;

-- in_patient_sessions enhancements
ALTER TABLE in_patient_sessions ADD COLUMN IF NOT EXISTS patient_id VARCHAR;
ALTER TABLE in_patient_sessions ADD COLUMN IF NOT EXISTS branch_id VARCHAR;
ALTER TABLE in_patient_sessions ADD COLUMN IF NOT EXISTS notes TEXT;

-- branches enhancements
ALTER TABLE branches ADD COLUMN IF NOT EXISTS branch_name VARCHAR;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS address TEXT;

-- fines (staff_fines) enhancements
ALTER TABLE staff_fines ADD COLUMN IF NOT EXISTS updated_by_staff_id VARCHAR;
ALTER TABLE staff_fines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE staff_fines ADD COLUMN IF NOT EXISTS deleted_by VARCHAR;

-- staff_expenses (expenses) enhancements
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS staff_id VARCHAR;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_by VARCHAR;

-- tasks enhancements
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR DEFAULT 'Individual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by VARCHAR;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_by VARCHAR;

-- notifications enhancements
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id VARCHAR;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;

-- universal audit_logs enhancements
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_id VARCHAR;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;

-- new tables
CREATE TABLE IF NOT EXISTS home_visits (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id VARCHAR NOT NULL REFERENCES staff(id),
  patient_id VARCHAR REFERENCES patients(id),
  visit_type VARCHAR NOT NULL,
  visit_date TIMESTAMP NOT NULL,
  payment_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

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
);

CREATE TABLE IF NOT EXISTS staff_incentives (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id VARCHAR NOT NULL REFERENCES staff(id),
  incentive_date DATE NOT NULL,
  clinic_visits INTEGER NOT NULL DEFAULT 0,
  inpatient_sessions INTEGER NOT NULL DEFAULT 0,
  incentive_count INTEGER NOT NULL DEFAULT 0,
  incentive_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_assignments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id VARCHAR NOT NULL REFERENCES tasks(id),
  staff_id VARCHAR NOT NULL REFERENCES staff(id),
  status VARCHAR NOT NULL DEFAULT 'Pending',
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_branch_id ON visits(branch_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_id ON attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_salaries_staff_id ON salaries(staff_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

COMMIT;
