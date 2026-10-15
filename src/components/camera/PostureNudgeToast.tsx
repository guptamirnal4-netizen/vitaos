"use client";

import { useEffect, useState } from "react";
import { useCameraStore } from "@/lib/store/cameraStore";
import { NUDGE_CONFIG, NUDGE_MESSAGES } from "@/lib/camera/postureNudges";

/**
 * In-app posture/gaze nudges, styled like the app's other toasts
 * (FriendRequestNotifier). Bottom-right on desktop so it never covers the
 * friend-request pop-ups (top-right); full-width along the bottom on phones.
 *
 * With "Alert as soon as my posture isn't optimal" on, a posture warning is
 * shown as a banner that stays — with the live correction — until posture is
 * back within limits. Dismissing it hides it until the next episode.
 * Timed nudges (gaze, break suggestions, or posture when instant alerts are
 * off) disappear after NUDGE_VISIBLE_MS as before.
 */
export function PostureNudgeToast() {
  const nudge = useCameraStore((s) => s.activeNudge);
  const dismiss = useCameraStore((s) => s.dismissNudge);
  const monitoring = useCameraStore((s) => s.monitoring);
  const instant = useCameraStore((s) => s.instantAlerts && s.alertsEnabled);
  const postureState = useCameraStore((s) => s.postureNudgeState);
  const recommendation = useCameraStore((s) => s.evaluation?.recommendation ?? null);
  const episode = useCameraStore((s) => s.postureEpisode);
  const [dismissedEpisode, setDismissedEpisode] = useState<number | null>(null);

  useEffect(() => {
    if (!nudge) return;
    const timer = setTimeout(dismiss, NUDGE_CONFIG.NUDGE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [nudge, dismiss]);

  const banner = instant && monitoring && postureState === "warning" && dismissedEpisode !== episode;
  // The banner already says it; don't stack the timed posture toast on top of it.
  const toast = nudge && !(banner && nudge.kind === "posture") ? nudge : null;
  if (!banner && !toast) return null;

  const message = toast ? (toast.title && toast.body ? { title: toast.title, body: toast.body } : NUDGE_MESSAGES[toast.kind]) : null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-4 md:right-4 md:items-end">
      {banner && (
        <div
          role="alert"
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border-2 border-warning bg-surface p-4 shadow-lg md:w-80"
        >
          <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-warning motion-reduce:animate-none" aria-hidden="true" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Your posture isn&apos;t optimal</div>
            <div className="mt-0.5 text-sm text-muted">{recommendation ?? NUDGE_MESSAGES.posture.body}</div>
            <div className="mt-1 text-xs text-muted">This goes away once you&apos;ve adjusted.</div>
          </div>
          <button
            onClick={() => setDismissedEpisode(episode)}
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Hide until next time"
          >
            ✕
          </button>
        </div>
      )}
      {toast && message && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-warning/40 bg-surface p-4 shadow-lg md:w-80"
        >
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">{message.title}</div>
            <div className="mt-0.5 text-sm text-muted">{message.body}</div>
          </div>
          <button onClick={dismiss} className="text-muted hover:text-foreground" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
