import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 60_000;

/**
 * Plays a short two-tone notification chime using the Web Audio API so we
 * don't need to ship an audio asset. Browsers may block audio until the user
 * has interacted with the page; in that case this silently no-ops.
 */
function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const tones = [
      { freq: 880, start: 0, duration: 0.18 },
      { freq: 1320, start: 0.16, duration: 0.28 },
    ];

    tones.forEach(({ freq, start, duration }) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + start);
      oscillator.stop(now + start + duration);
    });

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1200);
  } catch {
    // Audio not available / blocked — ignore.
  }
}

async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

export function UpdateAvailableNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // The version compiled into the currently running app.
  const currentVersion = useRef<string>(
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "",
  );
  const announced = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (announced.current) return;
    const deployed = await fetchDeployedVersion();
    if (!deployed || !currentVersion.current) return;

    if (deployed !== currentVersion.current) {
      announced.current = true;
      setUpdateAvailable(true);
      playNotificationSound();
    }
  }, []);

  useEffect(() => {
    checkForUpdate();

    const interval = window.setInterval(checkForUpdate, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkForUpdate);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, [checkForUpdate]);

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 sm:bottom-4 sm:px-6"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground">
              New Update Available
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Please refresh your browser to get the latest version.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Browser
            </Button>
          </div>
        </div>

        <div className="border-t border-border bg-muted/40 px-5 py-2.5 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            Powered by MernCrest Solution (Pvt) Ltd
          </p>
        </div>
      </div>
    </div>
  );
}

export default UpdateAvailableNotification;
