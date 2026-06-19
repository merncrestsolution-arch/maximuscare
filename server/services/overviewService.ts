import type { IStorage } from "../storage";
import { ENTERPRISE_BRANCHES, normalizeBranchName } from "@shared/branches";
import {
  MAXIMUS_BRANCH_CODES,
  NEXUS_BRANCH_CODE,
  BRANCH_CHART_COLORS,
} from "@shared/branchAccess";
import { computeExpenseBreakdown, isPaidPaymentStatus } from "./calculationEngine";

export interface OverviewKpis {
  totalPatients: number;
  totalIncome: number;
  totalExpenses: number;
  totalRevenue: number;
}

export interface BranchComparisonRow {
  code: string;
  branch: string;
  color: string;
  patients: number;
  income: number;
  expenses: number;
  revenue: number;
  visits: number;
  sessions: number;
}

function branchCodesForOverview(type: "maximus" | "nexus"): string[] {
  return type === "maximus" ? [...MAXIMUS_BRANCH_CODES] : [NEXUS_BRANCH_CODE];
}

async function buildBranchIdMap(storage: IStorage): Promise<Map<string, string>> {
  const branches = await storage.getAllBranches();
  const map = new Map<string, string>();
  for (const b of branches) {
    const shortName = normalizeBranchName(b.branchName ?? b.name);
    if (shortName) map.set(b.id, shortName);
  }
  return map;
}

function getItemBranchShortName(
  item: { branch?: string | null; branchId?: string | null },
  branchIdMap: Map<string, string>
): string {
  const fromText = normalizeBranchName(item.branch);
  if (fromText) return fromText;
  if (item.branchId) return branchIdMap.get(item.branchId) ?? "";
  return "";
}

function itemMatchesBranchCodes(
  item: { branch?: string | null; branchId?: string | null },
  codes: string[],
  branchIdMap: Map<string, string>
): boolean {
  const shortName = getItemBranchShortName(item, branchIdMap);
  return ENTERPRISE_BRANCHES.some(
    (b) => codes.includes(b.code) && b.shortName === shortName
  );
}

export async function computeOverviewKpis(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  type: "maximus" | "nexus"
): Promise<OverviewKpis> {
  const codes = branchCodesForOverview(type);
  const branchIdMap = await buildBranchIdMap(storage);
  const patients = (await storage.getAllPatients()).filter((p) =>
    itemMatchesBranchCodes(p, codes, branchIdMap)
  );
  const visits = (await storage.getVisitsByDateRange(rangeFrom, rangeTo)).filter((v) =>
    itemMatchesBranchCodes(v, codes, branchIdMap)
  );
  const expenses = (await storage.getExpensesByDateRange(rangeFrom, rangeTo)).filter((e) =>
    itemMatchesBranchCodes(e, codes, branchIdMap)
  );
  const totalIncome = visits
    .filter((v) => isPaidPaymentStatus(v.paymentStatus))
    .reduce((sum, v) => sum + (Number(v.paymentAmount) || 0), 0);
  const expenseBreakdown = computeExpenseBreakdown(expenses);
  const totalExpenses = expenseBreakdown.total;
  return {
    totalPatients: patients.length,
    totalIncome,
    totalExpenses,
    totalRevenue: totalIncome - totalExpenses,
  };
}

export interface OverviewExpenseCategory {
  category: string;
  amount: number;
}

export interface OverviewExpenseBreakdown {
  total: number;
  byCategory: OverviewExpenseCategory[];
}

/** Expense totals grouped by category for the whole organization (smart chart). */
export async function computeOverviewExpenseBreakdown(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  type: "maximus" | "nexus"
): Promise<OverviewExpenseBreakdown> {
  const codes = branchCodesForOverview(type);
  const branchIdMap = await buildBranchIdMap(storage);
  const expenses = (await storage.getExpensesByDateRange(rangeFrom, rangeTo)).filter((e) =>
    itemMatchesBranchCodes(e, codes, branchIdMap)
  );
  const { total, byCategory } = computeExpenseBreakdown(expenses);
  const rows = Object.entries(byCategory)
    .map(([category, amount]) => ({ category: category || "Uncategorized", amount: Number(amount) || 0 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { total, byCategory: rows };
}

export async function computeBranchComparisonRow(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  code: string
): Promise<BranchComparisonRow> {
  const def = ENTERPRISE_BRANCHES.find((b) => b.code === code)!;
  const branchIdMap = await buildBranchIdMap(storage);
  const matchesBranch = (item: { branch?: string | null; branchId?: string | null }) =>
    getItemBranchShortName(item, branchIdMap) === def.shortName;
  const visits = (await storage.getVisitsByDateRange(rangeFrom, rangeTo)).filter(matchesBranch);
  const patients = (await storage.getAllPatients()).filter(matchesBranch);
  const expenses = (await storage.getExpensesByDateRange(rangeFrom, rangeTo)).filter(matchesBranch);
  const sessions = (await storage.getAllInPatientSessionsInDateRange(rangeFrom, rangeTo)).filter(
    (s) => matchesBranch(s as { branch?: string; branchId?: string | null })
  );
  const income = visits
    .filter((v) => isPaidPaymentStatus(v.paymentStatus))
    .reduce((sum, v) => sum + (Number(v.paymentAmount) || 0), 0);
  const expenseTotal = computeExpenseBreakdown(expenses).total;
  return {
    code,
    branch: def.shortName,
    color: BRANCH_CHART_COLORS[code] ?? "#64748b",
    patients: patients.length,
    income,
    expenses: expenseTotal,
    revenue: income - expenseTotal,
    visits: visits.length,
    sessions: sessions.length,
  };
}

export async function computeMaximusComparison(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string
): Promise<BranchComparisonRow[]> {
  return Promise.all(
    MAXIMUS_BRANCH_CODES.map((code) => computeBranchComparisonRow(storage, rangeFrom, rangeTo, code))
  );
}

export async function computeNexusComparison(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string
): Promise<BranchComparisonRow[]> {
  const row = await computeBranchComparisonRow(storage, rangeFrom, rangeTo, NEXUS_BRANCH_CODE);
  return [{ ...row, branch: "Beruwala" }];
}
