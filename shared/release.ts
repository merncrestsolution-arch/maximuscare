// Single source of truth for the current app release.
//
// Human-readable release notes for local builds and fallback notifications.
// On Vercel, each git push auto-deploys and the server announces once per commit
// (VERCEL_GIT_COMMIT_SHA) — no manual version bump required for staff alerts.
// The client refresh banner polls /version.json every 30s and compares commit SHA.

export interface AppRelease {
  version: string;
  title: string;
  highlights: string[];
}

export const APP_RELEASE: AppRelease = {
  version: "1.5.1",
  title: "App Updated — What's New",
  highlights: [
    "Dashboard fix: Home screen charts and cards (Revenue trend, Home visit revenue, Attendance, Visit analytics, Branch revenue, Revenue summary, Expenses, Today attendance) now load branch-scoped data correctly.",
    "Attendance on the dashboard is scoped by staff in the selected branch instead of a missing branch column on attendance rows.",
    "Visits and revenue match by branch name or branch ID, so legacy and newer records both count.",
    "Nexus MD users now see the full financial dashboard like Admin and MD.",
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
