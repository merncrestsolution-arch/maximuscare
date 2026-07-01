import type { InPatientAdmission } from "@shared/schema";

/** Stable grouping key for the same person across admission episodes. */
export function resolveInPatientAdmissionKey(entry: {
  patientId?: string | null;
  patientCode?: string | null;
  patientName?: string;
  phone?: string;
  patientIdNo?: string | null;
}): string {
  if (entry.patientId) return `patient:${entry.patientId}`;
  if (entry.patientCode) return `code:${entry.patientCode}`;
  const name = String(entry.patientName || "").trim().toLowerCase();
  const phone = String(entry.phone || "").trim();
  const idNo = String(entry.patientIdNo || "").trim();
  return `legacy:${name}|${phone}|${idNo}`;
}

/**
 * Returns negative when `left` is MORE RECENT than `right` (should win as current episode).
 * Uses createdAt first so a re-admission with a backdated admitDate still becomes current.
 */
export function compareAdmissionRecency(left: InPatientAdmission, right: InPatientAdmission): number {
  const leftCreated = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
  const rightCreated = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
  if (leftCreated !== rightCreated) return rightCreated - leftCreated;

  const leftAdmit = left?.admitDate ? new Date(left.admitDate).getTime() : 0;
  const rightAdmit = right?.admitDate ? new Date(right.admitDate).getTime() : 0;
  if (leftAdmit !== rightAdmit) return rightAdmit - leftAdmit;

  return String(right?.id || "").localeCompare(String(left?.id || ""));
}

/** One row per person — the most recently created admission episode. */
export function pickLatestAdmissionsPerPatient(admissions: InPatientAdmission[]): InPatientAdmission[] {
  const latestByKey = new Map<string, InPatientAdmission>();
  for (const entry of admissions) {
    const key = resolveInPatientAdmissionKey(entry);
    const current = latestByKey.get(key);
    if (!current || compareAdmissionRecency(entry, current) < 0) {
      latestByKey.set(key, entry);
    }
  }
  return Array.from(latestByKey.values()).sort(compareAdmissionRecency);
}

export function normalizeAdmissionListStatus(status: string | undefined): string {
  return String(status || "").trim().toLowerCase();
}

/** Filter list views by the CURRENT (latest) admission status per patient. */
export function filterInPatientsByListStatus(
  allAdmissions: InPatientAdmission[],
  statusQuery: string | undefined
): InPatientAdmission[] {
  if (!statusQuery?.trim()) return allAdmissions;

  const tokens = statusQuery
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const normalized = tokens.map((value) => value.toLowerCase());

  if (normalized.includes("all")) return allAdmissions;

  const latestAdmissions = pickLatestAdmissionsPerPatient(allAdmissions);

  if (normalized.includes("active")) {
    return latestAdmissions.filter((entry) => {
      const current = normalizeAdmissionListStatus(entry.status);
      return current === "admitted" || current === "active";
    });
  }

  const allowed = new Set(normalized);
  return latestAdmissions.filter((entry) => allowed.has(normalizeAdmissionListStatus(entry.status)));
}

export function isCurrentlyAdmitted(admission: InPatientAdmission): boolean {
  const st = normalizeAdmissionListStatus(admission.status);
  return st === "admitted" || st === "active";
}
