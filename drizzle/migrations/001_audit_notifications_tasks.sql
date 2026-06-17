-- Maximus Clinic Manager — schema extension migration
-- Run via: npm run db:push (Drizzle) or apply manually on PostgreSQL

CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinic_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_fine_amount DECIMAL(10,2) NOT NULL DEFAULT 500,
  home_rate_colombo DECIMAL(10,2) NOT NULL DEFAULT 1000,
  home_rate_bandaragama DECIMAL(10,2) NOT NULL DEFAULT 500,
  holiday_home_rate DECIMAL(10,2) NOT NULL DEFAULT 1500,
  ot_rate_per_hour DECIMAL(10,2) NOT NULL DEFAULT 250,
  extra_holiday_deduction DECIMAL(10,2) NOT NULL DEFAULT 1500,
  free_absent_days INTEGER NOT NULL DEFAULT 4,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id VARCHAR NOT NULL REFERENCES staff(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to_staff_id VARCHAR NOT NULL REFERENCES staff(id),
  assigned_to_staff_name TEXT NOT NULL,
  created_by_staff_id VARCHAR NOT NULL REFERENCES staff(id),
  created_by_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  due_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR PRIMARY KEY,
  staff_id VARCHAR NOT NULL REFERENCES staff(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_snapshots (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id VARCHAR NOT NULL REFERENCES staff(id),
  staff_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  breakdown TEXT NOT NULL,
  final_salary DECIMAL(12,2) NOT NULL,
  created_by_staff_id VARCHAR NOT NULL REFERENCES staff(id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_staff_date_unique ON attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance(staff_id, date);

INSERT INTO branches (id, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Colombo', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'Colombo');

INSERT INTO branches (id, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Bandaragama', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'Bandaragama');
