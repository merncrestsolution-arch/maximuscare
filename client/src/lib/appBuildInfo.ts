/** Build metadata injected by Vite at compile time (see `vite.config.ts`). */
export interface AppBuildInfo {
  /** Unique deploy/build id (commit SHA or timestamp). */
  buildId: string;
  /** Human-readable semver from package.json. */
  displayVersion: string;
  /** ISO timestamp of when this bundle was built. */
  buildDateIso: string;
  /** Formatted for UI in clinic timezone. */
  buildDateLabel: string;
}

const CLINIC_TZ = "Asia/Colombo";

function formatBuildDate(iso: string): string {
  if (!iso) return "Unknown";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: CLINIC_TZ,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function getAppBuildInfo(): AppBuildInfo {
  const buildId = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
  const displayVersion =
    typeof __APP_DISPLAY_VERSION__ !== "undefined" ? __APP_DISPLAY_VERSION__ : "unknown";
  const buildDateIso = typeof __APP_BUILD_DATE__ !== "undefined" ? __APP_BUILD_DATE__ : "";
  return {
    buildId,
    displayVersion,
    buildDateIso,
    buildDateLabel: formatBuildDate(buildDateIso),
  };
}
