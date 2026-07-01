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
  version: "1.2.4",
  title: "App Updated — What's New",
  highlights: [
    "Version & build date now auto-generated at deploy — visible in footer, Profile, and Settings.",
    "Notifications: clear individual items or clear all (soft-deleted, kept for audit).",
    "Desktop alerts when admins send messages or assign tasks (enable via the in-app prompt).",
    "Attendance charts simplified to Present/Absent; duplicate day records cleaned up.",
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
