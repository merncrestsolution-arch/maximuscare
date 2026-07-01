import { normalizeBranchName } from "./branches";

/** Global clinic patient ID format: MXM-202506-000001 (no branch — year + month + monthly sequence). */
export const PATIENT_ID_PREFIX = "MXM";
export const PATIENT_ID_DIGITS = 6;

/**
 * Current patient code format (Bug 2/9): MC/<BRANCH_CODE>/<DDMM>/<SEQ>
 *   e.g. MC/DEH/2906/01 — 1st patient registered at Dehiwala on 29 June.
 * SEQ is a 2-digit, zero-padded sequence that resets per day, per branch.
 */
export const PATIENT_CODE_PREFIX = "MC";
export const PATIENT_CODE_SEQ_DIGITS = 2;

/** Maps the clinic's canonical branch short-names to their 3-letter patient-code segment. */
export const PATIENT_BRANCH_CODES: Record<string, string> = {
  "Dehiwala": "DEH",
  "Neuro Unit": "NEU",
  "Neuro Rehabilitation": "NEU",
  "Colombo Clinic": "COC",
  "Colombo Home": "COH",
  "Colombo": "COC",
  "Bandaragama": "BAN",
  "Beruwala": "BER",
  "Kandy": "KAN",
};

/** 3-letter branch code for a patient code; falls back to the first 3 letters of the branch name. */
export function patientBranchCode(branch: string | null | undefined): string {
  const normalized = normalizeBranchName(branch);
  if (PATIENT_BRANCH_CODES[normalized]) return PATIENT_BRANCH_CODES[normalized];
  const raw = String(branch ?? "").replace(/[^a-zA-Z]/g, "").trim();
  return (raw.slice(0, 3) || "GEN").toUpperCase();
}

/** DDMM (day + month) of a registration date, in the clinic's Sri Lanka timezone. */
export function patientIdDayMonth(date?: string | Date | null): string {
  if (typeof date === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
    if (match) return `${match[3]}${match[2]}`;
  }
  const d = date instanceof Date ? date : new Date();
  const colombo = d.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(colombo);
  return match ? `${match[3]}${match[2]}` : "";
}

export function formatPatientCode(branchCode: string, dayMonth: string, sequence: number): string {
  return `${PATIENT_CODE_PREFIX}/${branchCode}/${dayMonth}/${String(sequence).padStart(PATIENT_CODE_SEQ_DIGITS, "0")}`;
}

/** Returns the sequence for an existing code that matches the given branch + DDMM, else null. */
export function parsePatientCodeSequence(
  patientCode: string | null | undefined,
  branchCode: string,
  dayMonth: string,
): number | null {
  const code = String(patientCode ?? "").trim();
  if (!code) return null;
  const re = new RegExp(`^${PATIENT_CODE_PREFIX}/${branchCode}/${dayMonth}/(\\d+)$`, "i");
  const match = re.exec(code);
  return match ? parseInt(match[1], 10) : null;
}

/** True when a code already uses the current MC/<BRANCH>/<DDMM>/<SEQ> format. */
export function isCurrentPatientCode(patientCode: string | null | undefined): boolean {
  return /^MC\/[A-Z]+\/\d{3,4}\/\d+$/i.test(String(patientCode ?? "").trim());
}

/** Next MC code for a branch + registration date, given existing codes (seq resets per day per branch). */
export function nextPatientCode(
  codes: Array<string | null | undefined>,
  branch: string | null | undefined,
  registeredDate?: string | Date | null,
): string {
  const branchCode = patientBranchCode(branch);
  const dayMonth = patientIdDayMonth(registeredDate);
  let max = 0;
  for (const code of codes) {
    const seq = parsePatientCodeSequence(code, branchCode, dayMonth);
    if (seq != null) max = Math.max(max, seq);
  }
  return formatPatientCode(branchCode, dayMonth, max + 1);
}

/** Increment the sequence of an MC code (used to resolve rare collisions). */
export function bumpPatientCode(patientCode: string): string {
  const match = new RegExp(`^(${PATIENT_CODE_PREFIX}/[A-Za-z]+/\\d{3,4})/(\\d+)$`, "i").exec(patientCode.trim());
  if (match) {
    const seq = parseInt(match[2], 10) + 1;
    return `${match[1]}/${String(seq).padStart(PATIENT_CODE_SEQ_DIGITS, "0")}`;
  }
  return patientCode;
}

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
