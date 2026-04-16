type StaffLike = {
  id?: string | null;
  name?: string | null;
};

type VisitLike = {
  treatingStaffId?: string | null;
  treatingStaffName?: string | null;
  createdByStaffId?: string | null;
  createdByName?: string | null;
};

function normalize(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function sameNormalized(a?: string | null, b?: string | null): boolean {
  const aa = normalize(a);
  const bb = normalize(b);
  return aa.length > 0 && bb.length > 0 && aa === bb;
}

/**
 * Handles legacy/migrated data by matching both staff id and staff name.
 */
export function isVisitForStaff(
  visit: VisitLike,
  staff: StaffLike,
  options?: { includeCreator?: boolean }
): boolean {
  const byTreatingId = sameNormalized(visit.treatingStaffId, staff.id);
  const byTreatingName = sameNormalized(visit.treatingStaffName, staff.name);
  if (byTreatingId || byTreatingName) return true;

  if (options?.includeCreator) {
    const byCreatorId = sameNormalized(visit.createdByStaffId, staff.id);
    const byCreatorName = sameNormalized(visit.createdByName, staff.name);
    return byCreatorId || byCreatorName;
  }

  return false;
}
