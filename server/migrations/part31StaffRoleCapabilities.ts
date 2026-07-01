/**
 * Part 31 — per-staff MD/Manager capability flags (moved off clinic_settings).
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

export async function runPart31StaffRoleCapabilities(): Promise<void> {
  const boolDef = usePostgres ? "BOOLEAN" : "INTEGER";

  await addColumn("staff", "cap_location_exempt", boolDef);
  await addColumn("staff", "cap_view_attendance_location", boolDef);
  await addColumn("staff", "cap_view_all_staff_fines", boolDef);
  await addColumn("staff", "cap_manage_staff_fines", boolDef);
  await addColumn("staff", "cap_maximus_overview", boolDef);
  await addColumn("staff", "cap_nexus_overview", boolDef);

  // Copy legacy clinic-wide MD settings onto existing MD accounts (one-time).
  if (usePostgres) {
    await run(`
      UPDATE staff s SET
        cap_location_exempt = cs.md_location_exempt,
        cap_view_attendance_location = cs.md_view_attendance_location,
        cap_view_all_staff_fines = cs.md_view_all_staff_fines,
        cap_manage_staff_fines = cs.md_manage_staff_fines,
        cap_maximus_overview = cs.md_maximus_overview,
        cap_nexus_overview = cs.md_nexus_overview
      FROM clinic_settings cs
      WHERE s.role = 'MD' AND s.cap_location_exempt IS NULL
    `);
  } else {
    await run(`
      UPDATE staff SET
        cap_location_exempt = (SELECT md_location_exempt FROM clinic_settings LIMIT 1),
        cap_view_attendance_location = (SELECT md_view_attendance_location FROM clinic_settings LIMIT 1),
        cap_view_all_staff_fines = (SELECT md_view_all_staff_fines FROM clinic_settings LIMIT 1),
        cap_manage_staff_fines = (SELECT md_manage_staff_fines FROM clinic_settings LIMIT 1),
        cap_maximus_overview = (SELECT md_maximus_overview FROM clinic_settings LIMIT 1),
        cap_nexus_overview = (SELECT md_nexus_overview FROM clinic_settings LIMIT 1)
      WHERE role = 'MD' AND cap_location_exempt IS NULL
    `);
  }
}
