import type { IStorage } from "../storage";
import type { PriorInPatientEpisode } from "./inPatientAdmissionService";

export type PriorBillingExclusionSnapshot = {
  sourceId: string;
  episodeType: "readmit" | "transfer";
  admitDate: string;
  dischargeDate: string | null;
  branchName: string | null;
  grandTotal: number | null;
  amountPaid: number;
  pendingBalance: number;
};

export async function getExcludedPriorBillingSourceIds(
  storage: IStorage,
  admissionId: string,
): Promise<Set<string>> {
  const rows = await storage.getInPatientPriorBillingExclusionsByAdmission(admissionId);
  return new Set(rows.map((row) => row.sourceId));
}

export function filterExcludedPriorEpisodes(
  episodes: PriorInPatientEpisode[],
  excludedSourceIds: Set<string>,
): PriorInPatientEpisode[] {
  if (excludedSourceIds.size === 0) return episodes;
  return episodes.filter((episode) => !excludedSourceIds.has(episode.admissionId));
}
