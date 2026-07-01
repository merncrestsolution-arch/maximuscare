/**
 * Part 30 — admin-tunable MD role capability flags on clinic_settings.
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

export async function runPart30MdRoleCapabilities(): Promise<void> {
  const boolDef = usePostgres ? "BOOLEAN NOT NULL DEFAULT FALSE" : "INTEGER NOT NULL DEFAULT 0";
  const boolTrueDef = usePostgres ? "BOOLEAN NOT NULL DEFAULT TRUE" : "INTEGER NOT NULL DEFAULT 1";

  await addColumn("clinic_settings", "md_location_exempt", boolTrueDef);
  await addColumn("clinic_settings", "md_view_attendance_location", boolDef);
  await addColumn("clinic_settings", "md_view_all_staff_fines", boolTrueDef);
  await addColumn("clinic_settings", "md_manage_staff_fines", boolDef);
  await addColumn("clinic_settings", "md_maximus_overview", boolDef);
  await addColumn("clinic_settings", "md_nexus_overview", boolDef);
}
