import "dotenv/config";
import path from "path";
import { mkdirSync, existsSync } from "fs";
import { createRequire } from "module";
import { sql } from "drizzle-orm";
// Static Postgres imports so bundlers (esbuild / Vercel) inline the driver instead of
// resolving it from disk at runtime. The SQLite driver stays dynamic (dev-only, native).
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schemaSqlite from "@shared/schema-sqlite";
import * as schemaPg from "@shared/schema-pg";

// Resolve native deps from project root (works in CJS bundle and tsx dev; avoids import.meta in dist)
const requireMod = createRequire(path.join(process.cwd(), "package.json"));
// Accept both "postgresql://" and "postgres://" (Neon, Vercel Postgres, Supabase, etc.).
const usePostgres = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || "");

function createDb() {
  if (usePostgres) {
    const connectionString = process.env.DATABASE_URL!;
    // Managed Postgres (Neon, Vercel, Supabase, RDS, Render) requires TLS. Local
    // Postgres usually doesn't. Enable SSL for remote hosts and relax cert checks,
    // which Neon's pooled endpoints need on serverless.
    const needsSsl =
      /sslmode=require/i.test(connectionString) ||
      /neon\.tech|vercel|supabase|amazonaws|render\.com|azure|googleapis/i.test(connectionString);
    const isLocal = /@(localhost|127\.0\.0\.1)/i.test(connectionString);
    const pool = new pg.Pool({
      connectionString,
      ssl: needsSsl && !isLocal ? { rejectUnauthorized: false } : undefined,
    });
    return drizzlePg(pool, { schema: schemaPg });
  } else {
    const { drizzle } = requireMod("drizzle-orm/libsql");
    const { createClient } = requireMod("@libsql/client");
    const rawPath = process.env.DATABASE_URL || "./data/maximus.db";
    const dbPath = rawPath.startsWith(".")
      ? path.join(process.cwd(), rawPath)
      : rawPath.replace(/^sqlite:/, "");
    const dir = path.dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const client = createClient({ url: `file:${dbPath}` });
    return drizzle(client, { schema: schemaSqlite });
  }
}

const db = createDb();
export { db };

// Export the schema used by the current database (for storage/routes)
export const schema = usePostgres ? schemaPg : schemaSqlite;

async function addSqliteColumnIfMissing(query: string) {
  try {
    await db.run(sql.raw(query));
  } catch (error: any) {
    const message = String(error?.message ?? "");
    if (message.includes("duplicate column name")) return;
    throw error;
  }
}

/**
 * Keeps older SQLite database files compatible with the current schema.
 * We only add columns in an idempotent way here.
 */
export async function ensureSqliteSchemaCompatibility() {
  if (usePostgres) return;

  await addSqliteColumnIfMissing(
    "ALTER TABLE visits ADD COLUMN last_updated_by_staff_id TEXT",
  );
  await addSqliteColumnIfMissing(
    "ALTER TABLE visits ADD COLUMN last_updated_by_name TEXT",
  );
  await addSqliteColumnIfMissing(
    "ALTER TABLE staff ADD COLUMN photo_uri TEXT",
  );
  await addSqliteColumnIfMissing(
    "ALTER TABLE staff ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
  );
  await addSqliteColumnIfMissing(
    "ALTER TABLE staff ADD COLUMN basic_salary TEXT NOT NULL DEFAULT '0'",
  );
  await addSqliteColumnIfMissing(
    "ALTER TABLE staff ADD COLUMN salary_date TEXT",
  );
  await addSqliteColumnIfMissing(
    "ALTER TABLE staff ADD COLUMN other_adjustments TEXT NOT NULL DEFAULT '0'",
  );

  const createTables = [
    `CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS clinic_settings (
      id TEXT PRIMARY KEY,
      auto_fine_amount TEXT NOT NULL DEFAULT '500',
      home_rate_colombo TEXT NOT NULL DEFAULT '1000',
      home_rate_bandaragama TEXT NOT NULL DEFAULT '500',
      ot_rate_per_hour TEXT NOT NULL DEFAULT '250',
      extra_holiday_deduction TEXT NOT NULL DEFAULT '1500',
      free_absent_days INTEGER NOT NULL DEFAULT 4,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      assigned_to_staff_id TEXT NOT NULL REFERENCES staff(id),
      assigned_to_staff_name TEXT NOT NULL,
      created_by_staff_id TEXT NOT NULL REFERENCES staff(id),
      created_by_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'normal',
      due_date TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff(id),
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS payroll_snapshots (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff(id),
      staff_name TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      breakdown TEXT NOT NULL,
      final_salary TEXT NOT NULL,
      created_by_staff_id TEXT NOT NULL REFERENCES staff(id),
      created_by_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  ];
  for (const q of createTables) {
    await addSqliteColumnIfMissing(q);
  }

  try {
    await db.run(sql.raw(
      "CREATE UNIQUE INDEX IF NOT EXISTS attendance_staff_date_active_unique ON attendance(staff_id, date) WHERE deleted_at IS NULL"
    ));
    await db.run(sql.raw("CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date)"));
    await db.run(sql.raw("CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id)"));
    await db.run(sql.raw(
      "CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance(staff_id, date)"
    ));
  } catch {
    /* indexes optional on very old DBs */
  }

  const { runPart2SchemaMigration } = await import("./migrations/part2SchemaMigration");
  await runPart2SchemaMigration();
  const { runPart5SchemaMigration } = await import("./migrations/part5SchemaMigration");
  await runPart5SchemaMigration();
  const { runPart6SchemaMigration } = await import("./migrations/part6SchemaMigration");
  await runPart6SchemaMigration();
  const { runPart7SchemaMigration } = await import("./migrations/part7SchemaMigration");
  await runPart7SchemaMigration();
  const { runPart8SchemaMigration } = await import("./migrations/part8SchemaMigration");
  await runPart8SchemaMigration();
  const { runPart9EnterpriseMigration } = await import("./migrations/part9EnterpriseMigration");
  await runPart9EnterpriseMigration();
  const { runPart10AuthMigration } = await import("./migrations/part10AuthMigration");
  await runPart10AuthMigration();
  const { runPart11DocumentsAppointmentsMigration } = await import("./migrations/part11DocumentsAppointmentsMigration");
  await runPart11DocumentsAppointmentsMigration();
  const { runPart12BranchPermissionsMigration } = await import("./migrations/part12BranchPermissionsMigration");
  await runPart12BranchPermissionsMigration();
  const { runPart16PatientAgeOptionalMigration } = await import("./migrations/part16PatientAgeOptionalMigration");
  await runPart16PatientAgeOptionalMigration();
  const { runPart17PatientCodeBackfill } = await import("./migrations/part17PatientCodeBackfill");
  await runPart17PatientCodeBackfill();
  const { runPart13BranchIdBackfill } = await import("./migrations/part13BranchIdBackfill");
  await runPart13BranchIdBackfill();
  const { runPart14ExpensesBranch } = await import("./migrations/part14ExpensesBranch");
  await runPart14ExpensesBranch();
  const { runPart15EnterpriseConstraints } = await import("./migrations/part15EnterpriseConstraints");
  await runPart15EnterpriseConstraints();
  const { runPart18AttendanceGeo } = await import("./migrations/part18AttendanceGeo");
  await runPart18AttendanceGeo();
  const { runPart19PatientTransferLogs } = await import("./migrations/part19PatientTransferLogs");
  await runPart19PatientTransferLogs();
  const { runPart20PatientCodeFormatMigration } = await import("./migrations/part20PatientCodeFormatMigration");
  await runPart20PatientCodeFormatMigration();
  const { runPart22InpatientDeduction } = await import("./migrations/part22InpatientDeduction");
  await runPart22InpatientDeduction();
  const { runPart23SessionBranchBackfill } = await import("./migrations/part23SessionBranchBackfill");
  await runPart23SessionBranchBackfill();
  const { runPart24AdmissionSource } = await import("./migrations/part24AdmissionSource");
  await runPart24AdmissionSource();
  const { runPart25SalaryLineItems } = await import("./migrations/part25SalaryLineItems");
  await runPart25SalaryLineItems();
  const { runPart26BranchVerification } = await import("./migrations/part26BranchVerification");
  await runPart26BranchVerification();
  const { runPart27PatientDataVersion } = await import("./migrations/part27PatientDataVersion");
  await runPart27PatientDataVersion();
  const { runPart28InpatientStatusReconcile } = await import("./migrations/part28InpatientStatusReconcile");
  await runPart28InpatientStatusReconcile();
  const { runPart29AttendanceDedup } = await import("./migrations/part29AttendanceDedup");
  await runPart29AttendanceDedup();
  const { runPart30MdRoleCapabilities } = await import("./migrations/part30MdRoleCapabilities");
  await runPart30MdRoleCapabilities();
}

/** Runs Part 2 migration on PostgreSQL (SQLite runs it inside ensureSqliteSchemaCompatibility). */
export async function ensurePostgresSchemaCompatibility() {
  if (!usePostgres) return;

  const { ensurePostgresBootColumns } = await import("./pgBootstrap");
  await ensurePostgresBootColumns();

  const { runPart2SchemaMigration } = await import("./migrations/part2SchemaMigration");
  await runPart2SchemaMigration();
  const { runPart5SchemaMigration } = await import("./migrations/part5SchemaMigration");
  await runPart5SchemaMigration();
  const { runPart6SchemaMigration } = await import("./migrations/part6SchemaMigration");
  await runPart6SchemaMigration();
  const { runPart7SchemaMigration } = await import("./migrations/part7SchemaMigration");
  await runPart7SchemaMigration();
  const { runPart8SchemaMigration } = await import("./migrations/part8SchemaMigration");
  await runPart8SchemaMigration();
  const { runPart9EnterpriseMigration } = await import("./migrations/part9EnterpriseMigration");
  await runPart9EnterpriseMigration();
  const { runPart10AuthMigration } = await import("./migrations/part10AuthMigration");
  await runPart10AuthMigration();
  const { runPart11DocumentsAppointmentsMigration } = await import("./migrations/part11DocumentsAppointmentsMigration");
  await runPart11DocumentsAppointmentsMigration();
  const { runPart12BranchPermissionsMigration } = await import("./migrations/part12BranchPermissionsMigration");
  await runPart12BranchPermissionsMigration();
  const { runPart16PatientAgeOptionalMigration } = await import("./migrations/part16PatientAgeOptionalMigration");
  await runPart16PatientAgeOptionalMigration();
  const { runPart17PatientCodeBackfill } = await import("./migrations/part17PatientCodeBackfill");
  await runPart17PatientCodeBackfill();
  const { runPart13BranchIdBackfill } = await import("./migrations/part13BranchIdBackfill");
  await runPart13BranchIdBackfill();
  const { runPart14ExpensesBranch } = await import("./migrations/part14ExpensesBranch");
  await runPart14ExpensesBranch();
  const { runPart15EnterpriseConstraints } = await import("./migrations/part15EnterpriseConstraints");
  await runPart15EnterpriseConstraints();
  const { runPart18AttendanceGeo } = await import("./migrations/part18AttendanceGeo");
  await runPart18AttendanceGeo();
  const { runPart19PatientTransferLogs } = await import("./migrations/part19PatientTransferLogs");
  await runPart19PatientTransferLogs();
  const { runPart20PatientCodeFormatMigration } = await import("./migrations/part20PatientCodeFormatMigration");
  await runPart20PatientCodeFormatMigration();
  const { runPart21SalaryAdjustments } = await import("./migrations/part21SalaryAdjustments");
  await runPart21SalaryAdjustments();
  const { runPart22InpatientDeduction } = await import("./migrations/part22InpatientDeduction");
  await runPart22InpatientDeduction();
  const { runPart23SessionBranchBackfill } = await import("./migrations/part23SessionBranchBackfill");
  await runPart23SessionBranchBackfill();
  const { runPart24AdmissionSource } = await import("./migrations/part24AdmissionSource");
  await runPart24AdmissionSource();
  const { runPart25SalaryLineItems } = await import("./migrations/part25SalaryLineItems");
  await runPart25SalaryLineItems();
  const { runPart26BranchVerification } = await import("./migrations/part26BranchVerification");
  await runPart26BranchVerification();
  try {
    const { runPart27PatientDataVersion } = await import("./migrations/part27PatientDataVersion");
    await runPart27PatientDataVersion();
  } catch (error) {
    console.error("[db] Part 27 patient data migration failed (non-fatal):", error);
  }
  try {
    const { runPart28InpatientStatusReconcile } = await import("./migrations/part28InpatientStatusReconcile");
    await runPart28InpatientStatusReconcile();
  } catch (error) {
    console.error("[db] Part 28 inpatient status reconcile failed (non-fatal):", error);
  }
  try {
    const { runPart29AttendanceDedup } = await import("./migrations/part29AttendanceDedup");
    await runPart29AttendanceDedup();
  } catch (error) {
    console.error("[db] Part 29 attendance dedup failed (non-fatal):", error);
  }
  try {
    const { runPart30MdRoleCapabilities } = await import("./migrations/part30MdRoleCapabilities");
    await runPart30MdRoleCapabilities();
  } catch (error) {
    console.error("[db] Part 30 MD role capabilities failed (non-fatal):", error);
  }
}
