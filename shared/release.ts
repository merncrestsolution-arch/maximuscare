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
  version: "1.4.0",
  title: "App Updated — What's New",
  highlights: [
    "In-Patient Bill Deductions: Apply a fixed (LKR) or percentage discount on both the billing summary and the discharge screen, with a saved reason and an audit of who applied it. The deduction shows as its own line and updates the total in real time.",
    "Calendar Date Range: Reports now use a clean two-month calendar picker for custom date ranges instead of separate date boxes.",
    "Cleaner PDF Headers: The logo and Patient ID no longer overlap on Patient History and In-Patient Billing PDFs.",
    "Fixes: 'Mark Complete' now works for shared/common tasks, the Visit History edit/delete buttons no longer overlap the title, and the redundant live 'Today' attendance counter was removed from the dashboard.",
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
