/**
 * Part 32 — restore Maximus overview capability for MD accounts that inherited
 * md_maximus_overview = false from legacy clinic_settings during part 31 migration.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { migrationUsePostgres } from "./pgDetect";

const usePostgres = migrationUsePostgres();

async function run(statement: string) {
  const query = sql.raw(statement);
  if (usePostgres) {
    await (db as { execute: (q: ReturnType<typeof sql.raw>) => Promise<unknown> }).execute(query);
  } else {
    await db.run(query);
  }
}

export async function runPart32MdOverviewCapsFix(): Promise<void> {
  if (usePostgres) {
    await run(`
      UPDATE staff
      SET cap_maximus_overview = TRUE
      WHERE role = 'MD'
        AND (cap_maximus_overview IS NULL OR cap_maximus_overview = FALSE)
    `);
  } else {
    await run(`
      UPDATE staff
      SET cap_maximus_overview = 1
      WHERE role = 'MD'
        AND (cap_maximus_overview IS NULL OR cap_maximus_overview = 0)
    `);
  }
}
