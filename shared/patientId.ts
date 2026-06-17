/** Global clinic patient ID format: MXM-202506-000001 (no branch — year + month + monthly sequence). */
export const PATIENT_ID_PREFIX = "MXM";
export const PATIENT_ID_DIGITS = 6;

/** YYYYMM from registration date (defaults to today). */
export function patientIdYearMonth(date?: string | Date | null): string {
  if (typeof date === "string") {
    const iso = date.trim().slice(0, 10);
    const match = /^(\d{4})-(\d{2})/.exec(iso);
    if (match) return `${match[1]}${match[2]}`;
  }
  const d = date instanceof Date ? date : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

export function formatPatientId(yearMonth: string, sequence: number): string {
  return `${PATIENT_ID_PREFIX}-${yearMonth}-${String(sequence).padStart(PATIENT_ID_DIGITS, "0")}`;
}

/** Parses current and legacy patient codes; returns sequence for the given month when applicable. */
export function parsePatientIdSequence(
  patientCode: string | null | undefined,
  yearMonth?: string,
): number | null {
  const code = String(patientCode ?? "").trim();
  if (!code) return null;

  if (yearMonth) {
    const current = new RegExp(`^${PATIENT_ID_PREFIX}-${yearMonth}-(\\d+)$`, "i").exec(code);
    if (current) return parseInt(current[1], 10);

    // Legacy branch + date: DEHIWALA-202506-PAT000001
    const legacyBranchDated = new RegExp(`^[A-Z]+-${yearMonth}-PAT(\\d+)$`, "i").exec(code);
    if (legacyBranchDated) return parseInt(legacyBranchDated[1], 10);
  }

  const legacyGlobal = new RegExp(`^${PATIENT_ID_PREFIX}-(\\d{6})-(\\d+)$`, "i").exec(code);
  if (legacyGlobal && !yearMonth) return parseInt(legacyGlobal[2], 10);

  const legacyPat = /^PAT(\d+)$/i.exec(code);
  if (legacyPat) return parseInt(legacyPat[1], 10);

  const legacyDash = /^P-(\d+)$/i.exec(code);
  if (legacyDash) return parseInt(legacyDash[1], 10);

  const legacyBranch = /^[A-Z]+-(?:\d{6}-)?PAT(\d+)$/i.exec(code);
  if (legacyBranch && !yearMonth) return parseInt(legacyBranch[1], 10);

  return null;
}

export function nextPatientIdFromCodes(
  codes: Array<string | null | undefined>,
  registeredDate?: string | Date | null,
): string {
  const yearMonth = patientIdYearMonth(registeredDate);
  let max = 0;
  for (const code of codes) {
    const seq = parsePatientIdSequence(code, yearMonth);
    if (seq != null) max = Math.max(max, seq);
  }
  return formatPatientId(yearMonth, max + 1);
}

export function bumpPatientIdSequence(patientCode: string): string {
  const current = new RegExp(`^(${PATIENT_ID_PREFIX}-\\d{6})-(\\d+)$`, "i").exec(patientCode.trim());
  if (current) {
    const seq = parseInt(current[2], 10) + 1;
    const yearMonth = current[1].split("-")[1];
    return formatPatientId(yearMonth, seq);
  }

  const legacyBranchDated = /^([A-Z]+-\d{6})-PAT(\d+)$/i.exec(patientCode.trim());
  if (legacyBranchDated) {
    const seq = parseInt(legacyBranchDated[2], 10) + 1;
    return `${legacyBranchDated[1]}-PAT${String(seq).padStart(PATIENT_ID_DIGITS, "0")}`;
  }

  const legacyBranch = /^([A-Z]+)-PAT(\d+)$/i.exec(patientCode.trim());
  if (legacyBranch) {
    const seq = parseInt(legacyBranch[2], 10) + 1;
    return `${legacyBranch[1]}-PAT${String(seq).padStart(PATIENT_ID_DIGITS, "0")}`;
  }

  return patientCode;
}
