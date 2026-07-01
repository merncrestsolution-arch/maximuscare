/**
 * Part 9 — enterprise multi-branch DDL: user_branch_access, session branch, indexes.
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

async function createIndex(name: string, ddl: string) {
  try {
    await run(ddl);
  } catch {
    /* index may exist */
  }
}

const userBranchAccessDdl = usePostgres
  ? `CREATE TABLE IF NOT EXISTS user_branch_access (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id VARCHAR NOT NULL REFERENCES staff(id),
      branch_id VARCHAR NOT NULL REFERENCES branches(id),
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(staff_id, branch_id)
    )`
  : `CREATE TABLE IF NOT EXISTS user_branch_access (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff(id),
      branch_id TEXT NOT NULL REFERENCES branches(id),
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(staff_id, branch_id)
    )`;

export async function runPart9EnterpriseMigration() {
  await addColumn("branches", "code", "TEXT");
  await addColumn("auth_sessions", "selected_branch_id", "TEXT");
  await run(userBranchAccessDdl);

  await createIndex(
    "idx_user_branch_access_staff",
    "CREATE INDEX IF NOT EXISTS idx_user_branch_access_staff ON user_branch_access(staff_id)"
  );
  await createIndex(
    "idx_salaries_staff_month_unique",
    usePostgres
      ? "CREATE UNIQUE INDEX IF NOT EXISTS idx_salaries_staff_month_unique ON salaries(staff_id, salary_month) WHERE deleted_at IS NULL"
      : "CREATE UNIQUE INDEX IF NOT EXISTS idx_salaries_staff_month_unique ON salaries(staff_id, salary_month)"
  );
  await createIndex(
    "idx_patients_branch_id",
    "CREATE INDEX IF NOT EXISTS idx_patients_branch_id ON patients(branch_id)"
  );
  await createIndex(
    "idx_visits_branch_id_date",
    "CREATE INDEX IF NOT EXISTS idx_visits_branch_id_date ON visits(branch_id, visit_date)"
  );
}
