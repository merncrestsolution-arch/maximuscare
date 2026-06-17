/**
 * Part 10 — refresh tokens for JWT rotation.
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

export async function runPart10AuthMigration() {
  const ddl = usePostgres
    ? `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id VARCHAR NOT NULL REFERENCES staff(id),
        session_id VARCHAR NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    : `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL REFERENCES staff(id),
        session_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER,
        created_at INTEGER NOT NULL
      )`;

  await run(ddl);
  try {
    await run("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_staff ON refresh_tokens(staff_id)");
    await run("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON refresh_tokens(session_id)");
  } catch {
    /* exists */
  }
}
