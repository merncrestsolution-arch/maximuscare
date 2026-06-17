/**
 * Part 12 — user_branch_permissions table and session overview context.
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

const userBranchPermissionsDdl = usePostgres
  ? `CREATE TABLE IF NOT EXISTS user_branch_permissions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES staff(id),
      branch_id VARCHAR NOT NULL REFERENCES branches(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, branch_id)
    )`
  : `CREATE TABLE IF NOT EXISTS user_branch_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES staff(id),
      branch_id TEXT NOT NULL REFERENCES branches(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, branch_id)
    )`;

export async function runPart12BranchPermissionsMigration() {
  await addColumn("auth_sessions", "selected_context", "TEXT");
  await run(userBranchPermissionsDdl);

  try {
    await run(
      "CREATE INDEX IF NOT EXISTS idx_user_branch_permissions_user ON user_branch_permissions(user_id)"
    );
  } catch {
    /* index may exist */
  }

  // Backfill from user_branch_access when permissions table is empty
  if (usePostgres) {
    await run(`
      INSERT INTO user_branch_permissions (user_id, branch_id, created_at, updated_at)
      SELECT uba.staff_id, uba.branch_id, COALESCE(uba.created_at, NOW()), NOW()
      FROM user_branch_access uba
      WHERE NOT EXISTS (
        SELECT 1 FROM user_branch_permissions ubp
        WHERE ubp.user_id = uba.staff_id AND ubp.branch_id = uba.branch_id
      )
    `);
  } else {
    await run(`
      INSERT OR IGNORE INTO user_branch_permissions (id, user_id, branch_id, created_at, updated_at)
      SELECT lower(hex(randomblob(16))), uba.staff_id, uba.branch_id,
             COALESCE(uba.created_at, CAST(strftime('%s','now') AS INTEGER) * 1000),
             CAST(strftime('%s','now') AS INTEGER) * 1000
      FROM user_branch_access uba
    `);
  }
}
