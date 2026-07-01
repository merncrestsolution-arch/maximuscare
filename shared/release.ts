// Single source of truth for the current app release.
//
// Bump `version` and update `highlights` whenever you ship a deploy that you
// want every user to be notified about. On the first request after the new
// build goes live on Vercel, the server broadcasts a one-time "What's New"
// notification to all active staff (see server/services/appUpdateService.ts).
//
// The announcement is idempotent: it only fires once per `version`, no matter
// how many serverless cold starts or instances Vercel spins up.

export interface AppRelease {
  version: string;
  title: string;
  highlights: string[];
}

export const APP_RELEASE: AppRelease = {
  version: "1.5.0",
  title: "App Updated — What's New",
  highlights: [
    "Staff branch scoping: Salary, payroll, and attendance now show only staff assigned to the selected branch — no more mixing staff across Dehiwala, Bandaragama, Neuro, or Nexus.",
    "Data visibility fix: Patients, visits, attendance, and expenses load correctly again after branch selection (legacy records without branch metadata are no longer hidden).",
    "In-Patient mobile layout: New card-based list on phones with scrollable Admitted / Discharged tabs; desktop table view unchanged.",
    "New branch switcher: Tap the branch name in the header to open the updated workspace picker with branch cards and overview shortcuts.",
    "Please refresh your browser after this update to load the latest version.",
  ],
};

/** Human-readable message body used for the broadcast notification. */
export function buildReleaseMessage(release: AppRelease = APP_RELEASE): string {
  const lines = release.highlights.map((h) => `• ${h}`);
  return [
    `We just updated the app to v${release.version}.`,
    "",
    ...lines,
    "",
    "Tip: refresh your browser to load the latest version.",
  ].join("\n");
}
