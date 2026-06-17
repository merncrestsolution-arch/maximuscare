/** Enterprise branch short names for UI. */
export const BRANCH_OPTIONS = [
  { value: "Dehiwala", label: "Dehiwala Main Branch" },
  { value: "Bandaragama", label: "Bandaragama Branch" },
  { value: "Neuro Rehabilitation", label: "Neuro Rehabilitation Unit" },
  { value: "Nexus Physio", label: "Nexus Physio & Rehab Center (Beruwala)" },
] as const;

/** Client mirror of enterprise branch config — labels for UI only. */
export const HOME_VISIT_TYPES = ["Main", "Bandaragama", "Holiday"] as const;

export const HOME_VISIT_TYPE_LABELS: Record<string, string> = {
  Main: "Main branch (Dehiwala / Neuro / Nexus)",
  Bandaragama: "Bandaragama",
  Holiday: "Holiday (staff absent)",
  Colombo: "Main branch (legacy)",
};

export function homeVisitTypeLabel(type: string): string {
  return HOME_VISIT_TYPE_LABELS[type] ?? type;
}
