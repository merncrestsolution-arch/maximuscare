import type { IStorage } from "../storage";
import type { Branch } from "@shared/schema";
import { normalizeBranchName } from "@shared/branches";
import {
  hasFullBranchAccess,
  isNexusManagingDirector,
  isManagingDirector,
  NEXUS_BRANCH_CODE,
  type OverviewContext,
  canAccessMaximusOverview,
  canAccessNexusOverview,
} from "@shared/branchAccess";
import { loadStaffRoleCapabilities } from "./mdCapabilityService";

export interface BranchAccessContext {
  selectedBranchId: string | null;
  selectedBranchName: string | null;
  selectedContext: OverviewContext | null;
  allowedBranchIds: string[];
  allowedBranches: Branch[];
  canAccessMaximusOverview: boolean;
  canAccessNexusOverview: boolean;
}

export async function getUserBranchPermissionIds(
  storage: IStorage,
  staffId: string
): Promise<string[]> {
  const permissions = await storage.getUserBranchPermissions(staffId);
  if (permissions.length > 0) return permissions.map((p) => p.branchId);

  const access = await storage.getUserBranchAccess(staffId);
  if (access.length > 0) return access.map((a) => a.branchId);

  return [];
}

function activeBranches(branches: Branch[]): Branch[] {
  return branches.filter((b) => b.isActive !== false);
}

/** Branches an Admin/MD may transfer in-patients to — all active org branches. */
export async function getTransferDestinationBranches(
  storage: IStorage,
  staffId: string,
  role: string,
): Promise<Branch[]> {
  const all = activeBranches(await storage.getAllBranches());

  // In-patient transfer is Admin/MD only — always list every active branch.
  if (hasFullBranchAccess(role) || isManagingDirector(role)) {
    return all.sort((a, b) =>
      String(a.branchName ?? a.name).localeCompare(String(b.branchName ?? b.name)),
    );
  }

  if (isNexusManagingDirector(role)) {
    return all.filter((b) => String(b.code ?? "").toUpperCase() === NEXUS_BRANCH_CODE);
  }

  return activeBranches(await getAllowedBranchesForStaff(storage, staffId, role));
}

export async function getAllowedBranchesForStaff(
  storage: IStorage,
  staffId: string,
  role: string
): Promise<Branch[]> {
  const all = await storage.getAllBranches();

  if (hasFullBranchAccess(role)) {
    return all;
  }

  if (isNexusManagingDirector(role)) {
    return all.filter((b) => String(b.code ?? "").toUpperCase() === NEXUS_BRANCH_CODE);
  }

  const permissionIds = await getUserBranchPermissionIds(storage, staffId);
  if (permissionIds.length > 0) {
    const ids = new Set(permissionIds);
    return all.filter((b) => ids.has(b.id));
  }

  const staff = await storage.getStaff(staffId);
  if (!staff?.branch) {
    return [];
  }

  const normalized = normalizeBranchName(staff.branch);
  if (String(staff.branch).toLowerCase() === "both") {
    return all.filter((b) => {
      const code = String(b.code ?? "").toUpperCase();
      return code === "DEHIWALA" || code === "NEURO";
    });
  }

  return all.filter(
    (b) =>
      normalizeBranchName(b.branchName ?? b.name) === normalized ||
      b.name.toLowerCase().includes(normalized.toLowerCase())
  );
}

export async function resolveBranchAccessContext(
  storage: IStorage,
  staffId: string,
  role: string,
  session?: { selectedBranchId?: string | null; selectedContext?: string | null } | null
): Promise<BranchAccessContext> {
  const allowedBranches = await getAllowedBranchesForStaff(storage, staffId, role);
  const allowedBranchIds = allowedBranches.map((b) => b.id);

  const selectedContext = (session?.selectedContext as OverviewContext | null) ?? null;
  let selected: Branch | undefined;

  if (session?.selectedBranchId) {
    selected = allowedBranches.find((b) => b.id === session.selectedBranchId);
  }

  let canMaximusOverview = canAccessMaximusOverview(role);
  let canNexusOverview = canAccessNexusOverview(role);
  if (isManagingDirector(role)) {
    const mdCaps = await loadStaffRoleCapabilities(storage, staffId);
    if (mdCaps.maximusOverview) canMaximusOverview = true;
    if (mdCaps.nexusOverview) canNexusOverview = true;
  }

  return {
    selectedBranchId: selected?.id ?? null,
    selectedBranchName: selected ? (selected.branchName ?? selected.name) : null,
    selectedContext,
    allowedBranchIds,
    allowedBranches,
    canAccessMaximusOverview: canMaximusOverview,
    canAccessNexusOverview: canNexusOverview,
  };
}

export function assertBranchAccess(
  branchId: string | null | undefined,
  allowedBranchIds: string[]
): void {
  if (!branchId) {
    throw new Error("Branch context required. Select a branch to continue.");
  }
  if (!allowedBranchIds.includes(branchId)) {
    throw new Error("Unauthorized Branch Access");
  }
}

export async function assertOverviewAccess(
  storage: IStorage,
  staffId: string,
  role: string,
  context: OverviewContext,
): Promise<void> {
  const ctx = await resolveBranchAccessContext(storage, staffId, role, { selectedContext: context });
  if (context === "maximus-overview" && !ctx.canAccessMaximusOverview) {
    throw new Error("Unauthorized access to Maximus Overview");
  }
  if (context === "nexus-overview" && !ctx.canAccessNexusOverview) {
    throw new Error("Unauthorized access to Nexus Overview");
  }
}

export function filterByBranchName<T extends { branch?: string | null }>(
  items: T[],
  branchName: string | null | undefined
): T[] {
  if (!branchName) return items;
  const target = normalizeBranchName(branchName).toLowerCase();
  return items.filter((item) => normalizeBranchName(item.branch).toLowerCase() === target);
}

export function hasCompletedBranchSelection(ctx: BranchAccessContext): boolean {
  return !!ctx.selectedBranchId || !!ctx.selectedContext;
}

/**
 * Resolves a branch row id from a branch name/alias (normalized). When several
 * branch rows share the same normalized name, the canonical enterprise row
 * (one carrying a non-null `code`) is preferred. Returns null when no match.
 */
export async function resolveBranchIdByName(
  storage: IStorage,
  branchName: string | null | undefined
): Promise<string | null> {
  const normalized = normalizeBranchName(branchName ?? "");
  if (!normalized) return null;
  const all = await storage.getAllBranches();
  const matches = all.filter(
    (b) => normalizeBranchName(b.branchName ?? b.name) === normalized
  );
  if (matches.length === 0) return null;
  const canonical = matches.find((b) => !!b.code);
  return (canonical ?? matches[0]).id;
}
