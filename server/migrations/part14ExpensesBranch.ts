/**
 * Part 14 — branch column on expenses for branch-isolated reporting.
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

export async function runPart14ExpensesBranch() {
  await addColumn("expenses", "branch", "TEXT");

  const expenses = await storage.getAllExpenses();
  for (const exp of expenses) {
    if ((exp as { branch?: string }).branch) continue;
    const staff = exp.staffId ? await storage.getStaff(exp.staffId) : await storage.getStaff(exp.createdByStaffId);
    const branch = staff?.branch ? normalizeBranchName(staff.branch) : null;
    if (branch) {
      await storage.updateExpense(exp.id, { branch } as any);
    }
  }

  try {
    await run("CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses(branch, expense_date)");
  } catch {
    /* optional */
  }
}
