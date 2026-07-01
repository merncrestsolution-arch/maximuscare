import type { IStorage } from "../storage";
import { APP_RELEASE, buildReleaseMessage } from "@shared/release";
import { broadcastToActiveStaff } from "./notificationService";

const APP_UPDATE_TYPE = "app_update";

/** Unique id per Vercel deploy (commit SHA); falls back to APP_RELEASE.version locally. */
function getDeployId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (sha) return sha.length > 12 ? sha.slice(0, 12) : sha;
  return APP_RELEASE.version;
}

/** Marker embedded in the notification title so we can detect prior announcements. */
function versionTag(deployId: string): string {
  return `v${deployId}`;
}

function buildDeployMessage(): string {
  const commitMsg = process.env.VERCEL_GIT_COMMIT_MESSAGE?.trim();
  if (commitMsg) {
    return [
      `We just deployed an update (${getDeployId()}).`,
      "",
      commitMsg,
      "",
      "Tip: refresh your browser to load the latest version.",
    ].join("\n");
  }
  return buildReleaseMessage();
}

/**
 * Broadcast a one-time "What's New" notification to every active staff member
 * after a new release is deployed. Safe to call on every server boot / Vercel
 * cold start: it checks whether the current release version has already been
 * announced and no-ops if so, so each version is only ever announced once.
 */
export async function announceAppUpdateIfNeeded(
  storage: IStorage,
  options: { force?: boolean } = {},
): Promise<number> {
  const deployId = getDeployId();
  const tag = versionTag(deployId);

  // Idempotency guard: bail out if this deploy was already announced (unless
  // an admin explicitly forces a re-send).
  if (!options.force) {
    try {
      const alreadySent = await storage.hasAppUpdateAnnouncement(tag);
      if (alreadySent) return 0;
    } catch (err) {
      // If the lookup fails (e.g. table not yet migrated), skip rather than risk
      // spamming users on every cold start.
      console.error("[appUpdate] announcement lookup failed:", err);
      return 0;
    }
  }

  try {
    const count = await broadcastToActiveStaff(storage, {
      title: `${APP_RELEASE.title} (${tag})`,
      message: buildDeployMessage(),
      type: APP_UPDATE_TYPE,
    });
    if (count > 0) {
      console.log(
        `[appUpdate] announced release ${tag} to ${count} active staff`,
      );
    }
    return count;
  } catch (err) {
    console.error("[appUpdate] failed to broadcast release notification:", err);
    return 0;
  }
}
