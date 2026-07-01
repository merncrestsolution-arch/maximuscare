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

const url = process.env.DATABASE_URL || "";
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
  ["branches", "verified_by_admin", "BOOLEAN NOT NULL DEFAULT FALSE"],
];

async function run() {
  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  try {
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
