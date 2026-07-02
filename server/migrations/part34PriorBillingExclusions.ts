import { db } from "../db";
import { sql } from "drizzle-orm";

const usePostgres = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || "");

async function run(statement: string) {
  const query = sql.raw(statement);
  if (usePostgres) {
    await (db as { execute: (q: ReturnType<typeof sql.raw>) => Promise<unknown> }).execute(query);
  } else {
    await db.run(query);
  }
}

/** Soft-exclude a prior billing episode from displays and balance calculations. */
export async function runPart34PriorBillingExclusions() {
  if (usePostgres) {
    await run(`
      CREATE TABLE IF NOT EXISTS in_patient_prior_billing_exclusions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id VARCHAR NOT NULL,
        source_id TEXT NOT NULL,
        episode_type TEXT NOT NULL,
        excluded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        excluded_by_staff_id TEXT,
        excluded_by_name TEXT,
        snapshot_json JSONB
      )
    `);
    await run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_prior_billing_excl_admission_source
      ON in_patient_prior_billing_exclusions (admission_id, source_id)
    `);
  } else {
    await run(`
      CREATE TABLE IF NOT EXISTS in_patient_prior_billing_exclusions (
        id TEXT PRIMARY KEY,
        admission_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        episode_type TEXT NOT NULL,
        excluded_at INTEGER NOT NULL,
        excluded_by_staff_id TEXT,
        excluded_by_name TEXT,
        snapshot_json TEXT
      )
    `);
    await run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_prior_billing_excl_admission_source
      ON in_patient_prior_billing_exclusions (admission_id, source_id)
    `);
  }
}
