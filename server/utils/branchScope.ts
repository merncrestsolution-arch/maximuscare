import { normalizeBranchName } from "@shared/branches";

export function branchIdsForName(
  branches: { id: string; name: string; branchName?: string | null }[],
  branchName: string
): Set<string> {
  const target = normalizeBranchName(branchName).toLowerCase();
  return new Set(
    branches
      .filter((b) =>
        normalizeBranchName((b as { branchName?: string | null }).branchName ?? b.name).toLowerCase() ===
        target
      )
      .map((b) => b.id)
  );
}

export function recordMatchesBranchScope(
  record: { branch?: string | null; branchId?: string | null },
  branchId: string | null,
  branchName: string | null,
  branchIdsForName?: Set<string> | null
): boolean {
  if (!branchId && !branchName) return true;
  if (branchId && record.branchId && record.branchId === branchId) return true;
  if (branchIdsForName?.size && record.branchId && branchIdsForName.has(record.branchId)) return true;
  if (branchName && record.branch) {
    return (
      normalizeBranchName(record.branch).toLowerCase() ===
      normalizeBranchName(branchName).toLowerCase()
    );
  }
  // Legacy rows without branch metadata — keep when a branch is selected.
  return !record.branchId && !String(record.branch ?? "").trim();
}

export function filterRecordsByBranchScope<T extends { branch?: string | null; branchId?: string | null }>(
  records: T[],
  branchId: string | null,
  branchName: string | null,
  branchIdsForName?: Set<string> | null
): T[] {
  if (!branchId && !branchName) return records;
  return records.filter((r) =>
    recordMatchesBranchScope(r, branchId, branchName, branchIdsForName)
  );
}
