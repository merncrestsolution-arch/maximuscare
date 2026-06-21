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
  version: "1.3.0",
  title: "App Updated — What's New",
  highlights: [
    "Premium PDF Redesign: All exported reports now feature a deeply redesigned, highly professional corporate layout.",
    "Smart Table Scaling: PDF reports with massive amounts of data (like the Physio Summary) now automatically generate in Landscape orientation so data is perfectly spaced and legible.",
    "Elegant Styling: PDFs now include right-aligned titles, subtle teal accent lines, structured table grids, and formal page footers."
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
