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
  version: "1.1.2",
  title: "App Updated — What's New",
  highlights: [
    "Multi-branch support with quick branch switching.",
    "New Reports hub: revenue, sessions, attendance, expenses & incentives.",
    "Salary & payroll: generate, approve, fines, OT and deductions.",
    "Expense tracking and per-branch dashboards.",
    "In-app notifications and task assignments.",
    "Performance, stability and UI improvements across the app.",
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
