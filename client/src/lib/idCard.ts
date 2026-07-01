import { downloadAuthenticatedFile } from "@/lib/api";

/**
 * Default clinic hotline printed on every patient ID card. The label on the card
 * reads "CLINIC HOTLINE" (previously "Hospital Hotline").
 */
export const CLINIC_HOTLINE = "+94 77 647 9364";
/** @deprecated kept for backwards compatibility — use {@link CLINIC_HOTLINE}. */
export const HOSPITAL_HOTLINE = CLINIC_HOTLINE;

export type OrganizationId = "maximus" | "nexus";

export function organizationDisplayName(org: OrganizationId | string | null | undefined): string {
  return "Maximus Care";
}

/** A short, human-readable, unique card identifier printed on the card. */
export function generateCardId(seed: string): string {
  const cleanSeed = (seed || "").trim();
  let base = "";
  const match = /^MC\/([A-Z]+)\/\d+\/(\d+)$/i.exec(cleanSeed);
  if (match) {
    const branch = match[1].toUpperCase();
    const seq = parseInt(match[2], 10);
    base = `MC${branch}${seq}`;
  } else {
    base = cleanSeed.replace(/[^a-z0-9]+/gi, "").toUpperCase().slice(0, 8) || "PT";
  }
  const chars = "0123456789ABCDEF";
  let hash = "";
  for (let i = 0; i < 8; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MX-${base}-${hash}`;
}

export interface PatientIdCardDownloadInput {
  kind: "outpatient" | "inpatient";
  /** Patient master id (out-patient) or admission id (in-patient). */
  recordId: string;
  patientCode?: string | null;
}

/** Download a print-ready PNG generated from template.svg on the server. */
export async function downloadPatientIdCard(input: PatientIdCardDownloadInput): Promise<void> {
  const endpoint =
    input.kind === "outpatient"
      ? `/patients/${encodeURIComponent(input.recordId)}/id-card?format=png`
      : `/inpatients/${encodeURIComponent(input.recordId)}/id-card?format=png`;
  const fallback = `${(input.patientCode || input.recordId).replace(/[^a-z0-9._-]+/gi, "-")}-card.png`;
  await downloadAuthenticatedFile(endpoint, fallback);
}
