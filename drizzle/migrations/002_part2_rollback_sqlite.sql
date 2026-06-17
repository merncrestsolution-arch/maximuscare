-- Part 2 ROLLBACK migration (SQLite)
-- Drops NEW tables and indexes added in Part 2 forward migration.
-- Does NOT drop columns from existing tables (SQLite requires table rebuild).
-- To fully rollback column additions, restore from pre-migration backup.

DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_tasks_due_date;
DROP INDEX IF EXISTS idx_salaries_staff_id;
DROP INDEX IF EXISTS idx_attendance_staff_id;
DROP INDEX IF EXISTS idx_attendance_attendance_date;
DROP INDEX IF EXISTS idx_visits_visit_date;
DROP INDEX IF EXISTS idx_visits_patient_id;
DROP INDEX IF EXISTS idx_visits_branch_id;
DROP INDEX IF EXISTS idx_patients_full_name;

DROP TABLE IF EXISTS task_assignments;
DROP TABLE IF EXISTS staff_incentives;
DROP TABLE IF EXISTS salaries;
DROP TABLE IF EXISTS home_visits;
