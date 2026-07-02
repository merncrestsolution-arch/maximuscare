// One-time-safe, idempotent schema repair for Postgres (Neon on Vercel).
//
// Early builds created several boolean flags as INTEGER columns (mirroring the
// SQLite schema). On Postgres the app passes JS booleans (true/false), which
// fails against an integer column ("invalid input syntax for type integer:
// 'true'"). This script converts those columns to a real `boolean` type using an
// explicit cast that drizzle-kit push cannot generate on its own.
//
// Runs BEFORE `drizzle-kit push` in the Vercel build. It is fully idempotent:
// - On a fresh DB (tables don't exist yet) every ALTER is skipped; push then
//   creates the columns as boolean directly from schema-pg.ts.
// - On the legacy integer DB the columns are converted in place (data preserved).
// - On an already-boolean DB the casts are no-ops.
import "dotenv/config";
import pg from "pg";
import { migrationDatabaseUrl } from "./postgresUrl";

const url = migrationDatabaseUrl();
if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.log("[db-fix] Non-Postgres DATABASE_URL; skipping boolean repair.");
  process.exit(0);
}

// table, column, default value to restore after the type change
const columns: Array<[string, string, "true" | "false"]> = [
  ["staff", "is_active", "true"],
  ["branches", "is_active", "true"],
  ["user_branch_access", "is_default", "false"],
  ["notifications", "is_read", "false"],
  ["notifications", "is_archived", "false"],
  ["appointments", "reminder_sent", "false"],
];

const newColumns: Array<[string, string, string]> = [
  ["patients", "data_version", "INTEGER NOT NULL DEFAULT 2"],
  ["patients", "data_migrated_at", "TIMESTAMP"],
  ["patients", "qr_token", "TEXT"],
  ["patients", "qr_token_expires_at", "TIMESTAMP"],
  ["patients", "id_card_pdf_key", "TEXT"],
  ["patients", "id_card_qr_token", "TEXT"],
  ["patients", "id_card_generated_at", "TIMESTAMP"],
  ["clinic_settings", "md_location_exempt", "BOOLEAN NOT NULL DEFAULT TRUE"],
  ["clinic_settings", "md_view_attendance_location", "BOOLEAN NOT NULL DEFAULT FALSE"],
  ["clinic_settings", "md_view_all_staff_fines", "BOOLEAN NOT NULL DEFAULT TRUE"],
  ["clinic_settings", "md_manage_staff_fines", "BOOLEAN NOT NULL DEFAULT FALSE"],
  ["clinic_settings", "md_maximus_overview", "BOOLEAN NOT NULL DEFAULT FALSE"],
  ["clinic_settings", "md_nexus_overview", "BOOLEAN NOT NULL DEFAULT FALSE"],
  ["staff", "cap_location_exempt", "BOOLEAN"],
  ["staff", "cap_view_attendance_location", "BOOLEAN"],
  ["staff", "cap_view_all_staff_fines", "BOOLEAN"],
  ["staff", "cap_manage_staff_fines", "BOOLEAN"],
  ["staff", "cap_maximus_overview", "BOOLEAN"],
  ["staff", "cap_nexus_overview", "BOOLEAN"],
];

async function run() {
  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const staffExists = await pool.query(`SELECT to_regclass('public.staff') AS reg`);
    if (staffExists.rows[0]?.reg) {
      const rtExists = await pool.query(`SELECT to_regclass('public.refresh_tokens') AS reg`);
      if (!rtExists.rows[0]?.reg) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS refresh_tokens (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_id VARCHAR NOT NULL REFERENCES staff(id),
            session_id VARCHAR NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            revoked_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        await pool.query(
          `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_staff ON refresh_tokens(staff_id)`,
        );
        await pool.query(
          `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens(session_id)`,
        );
        console.log("[db-fix] created refresh_tokens table");
      }
    }

    for (const [table, column, definition] of newColumns) {
      try {
        const { rows } = await pool.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_name = $1 AND column_name = $2`,
          [table, column],
        );
        if (rows.length > 0) continue;
        await pool.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
        console.log(`[db-fix] added ${table}.${column}`);
      } catch (err) {
        console.warn(`[db-fix] skip add ${table}.${column}:`, (err as Error).message);
      }
    }

    for (const [table, column, def] of columns) {
      try {
        // Skip if the column is already boolean (keeps logs clean and avoids churn).
        const { rows } = await pool.query(
          `SELECT data_type FROM information_schema.columns
           WHERE table_name = $1 AND column_name = $2`,
          [table, column],
        );
        if (rows.length === 0) {
          continue; // table/column not created yet — push will create it as boolean
        }
        if (rows[0].data_type === "boolean") {
          continue;
        }

        await pool.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`);
        await pool.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE boolean USING ("${column}"::boolean)`,
        );
        await pool.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT ${def}`,
        );
        console.log(`[db-fix] ${table}.${column} -> boolean (default ${def})`);
      } catch (err) {
        console.warn(`[db-fix] skip ${table}.${column}:`, (err as Error).message);
      }
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("[db-fix] failed:", err);
  // Don't fail the build — push will still run and create fresh tables if needed.
  process.exit(0);
});
