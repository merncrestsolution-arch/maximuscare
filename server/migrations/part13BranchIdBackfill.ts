/**
 * Part 13 — backfill branch_id on patients and visits from branch text + legacy aliases.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { ENTERPRISE_BRANCHES, normalizeBranchName } from "@shared/branches";

const usePostgres = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || "");

async function run(statement: string) {
  const query = sql.raw(statement);
  if (usePostgres) {
    await (db as { execute: (q: ReturnType<typeof sql.raw>) => Promise<unknown> }).execute(query);
  } else {
    await db.run(query);
  }
}

function buildBranchMap(branches: Awaited<ReturnType<typeof storage.getAllBranches>>) {
  const map = new Map<string, string>();
  for (const b of branches) {
    map.set(String(b.name ?? "").toLowerCase(), b.id);
    map.set(String(b.branchName ?? "").toLowerCase(), b.id);
    map.set(String(b.code ?? "").toLowerCase(), b.id);
    for (const def of ENTERPRISE_BRANCHES) {
      if (def.name === b.name || def.shortName === b.branchName || def.code === b.code) {
        map.set(def.shortName.toLowerCase(), b.id);
        map.set(def.name.toLowerCase(), b.id);
        map.set(def.code.toLowerCase(), b.id);
      }
    }
  }
  return map;
}

function resolveBranchId(branchText: string | null | undefined, branchMap: Map<string, string>): string | null {
  const normalized = normalizeBranchName(branchText ?? "");
  if (!normalized) return null;
  return branchMap.get(normalized.toLowerCase()) ?? null;
}

export async function runPart13BranchIdBackfill() {
  const branches = await storage.getAllBranches();
  const branchMap = buildBranchMap(branches);

  const patients = await storage.getAllPatients();
  for (const p of patients) {
    if (p.branchId) continue;
    const branchId = resolveBranchId(p.branch, branchMap);
    if (branchId) await storage.updatePatient(p.id, { branchId } as any);
  }

  const visits = await storage.getAllVisits();
  for (const v of visits) {
    if (v.branchId) continue;
    const branchId = resolveBranchId(v.branch, branchMap);
    if (branchId) await storage.updateVisit(v.id, { branchId } as any);
  }

  try {
    await run("CREATE INDEX IF NOT EXISTS idx_appointments_branch_date ON appointments(branch, appointment_date)");
  } catch {
    /* optional */
  }
}
