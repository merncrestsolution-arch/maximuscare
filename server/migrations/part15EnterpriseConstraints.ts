/**
 * Part 15 — soft deletes on appointments, branch_id on appointments, audit indexes.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { normalizeBranchName } from "@shared/branches";

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

export async function runPart15EnterpriseConstraints() {
  await addColumn("appointments", "deleted_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("appointments", "deleted_by", usePostgres ? "VARCHAR" : "TEXT");
  await addColumn("appointments", "branch_id", usePostgres ? "VARCHAR" : "TEXT");

  const branches = await storage.getAllBranches();
  const branchMap = new Map<string, string>();
  for (const b of branches) {
    branchMap.set(normalizeBranchName(b.branchName ?? b.name).toLowerCase(), b.id);
    branchMap.set(String(b.name ?? "").toLowerCase(), b.id);
  }

  try {
    const appointments = await storage.getAllAppointments();
    for (const appt of appointments) {
      if (!appt.branch) continue;
      const branchId = branchMap.get(normalizeBranchName(appt.branch).toLowerCase());
      if (!branchId) continue;
      await run(
        usePostgres
          ? `UPDATE appointments SET branch_id = '${branchId}' WHERE id = '${appt.id}' AND branch_id IS NULL`
          : `UPDATE appointments SET branch_id = '${branchId}' WHERE id = '${appt.id}' AND branch_id IS NULL`
      );
    }
  } catch {
    /* branch_id column may not exist on very old DBs until addColumn runs */
  }

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_visits_branch_date ON visits(branch_id, visit_date)",
    "CREATE INDEX IF NOT EXISTS idx_patients_branch_id ON patients(branch_id)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_branch_id ON appointments(branch_id)",
  ];
  for (const idx of indexes) {
    try {
      await run(idx);
    } catch {
      /* optional on legacy DBs */
    }
  }
}
