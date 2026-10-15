"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useWellnessStore } from "@/lib/store/wellnessStore";
import { minutesAgoLabel, useNow } from "@/lib/useNow";
import { useCameraStore } from "@/lib/store/cameraStore";
import { usePostureMonitor } from "@/components/camera/PostureMonitorProvider";
import { PageHeader } from "@/components/shell/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Icon } from "@/components/ui/Icon";
import { PostureLivePanel } from "@/components/camera/PostureLivePanel";
import { CameraUnavailablePanel } from "@/components/camera/CameraUnavailablePanel";
import { PostureGazeStatus } from "@/components/camera/PostureGazeStatus";
import { ActivityExplorer } from "@/components/dashboard/ActivityExplorer";

function formatDuration(startedAt: number | null): string {
  if (!startedAt) return "0 min";
  const totalSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes} min`;
}

export default function PosturePage() {
  const scores = useWellnessStore((s) => s.scores);
  const lastPostureCorrectionAt = useWellnessStore((s) => s.lastPostureCorrectionAt);
  const now = useNow();
  const prolongedGaze = useWellnessStore((s) => s.prolongedGaze);
  const logEvent = useWellnessStore((s) => s.logEvent);

  const sessionState = useCameraStore((s) => s.sessionState);
  const sessionError = useCameraStore((s) => s.sessionError);
  const monitoringStartedAt = useCameraStore((s) => s.monitoringStartedAt);
  const slouchEventsToday = useCameraStore((s) => s.slouchEventsToday);
  const activity = useCameraStore((s) => s.activity);
  const calibration = useCameraStore((s) => s.calibration);
  const calibrating = useCameraStore((s) => s.calibrating);
  const setCalibration = useCameraStore((s) => s.setCalibration);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { start, stop, pause, resume, calibrate, stream } = usePostureMonitor();
  const [, forceTick] = useState(0);

  const running = sessionState === "running";
  const paused = sessionState === "paused";
  const starting = sessionState === "starting";
  const active = running || paused;
  const canCalibrate = running && (activity?.state === "SITTING" || activity?.state === "STANDING");

  // Monitoring lives in PostureMonitorProvider; this page just previews the same stream.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) video.play().catch(() => {});
  }, [stream]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        icon="module.posture"
        title="Posture & Gaze Guard"
        subtitle="Live posture feedback that adapts to what you're doing — sitting at a laptop, on your phone, standing or lying down."
      />

      {!active && (
        <section aria-labelledby="camera-privacy" className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <h2 id="camera-privacy" className="flex items-center gap-2 font-semibold text-foreground">
            <Icon name="status.info" size={18} className="text-accent-foreground" />
            How the camera is used
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Video is analysed on this device, in your browser. Frames are never recorded, saved or uploaded.</li>
            <li>The camera only runs after you press Start, and turns off when you press Stop or leave the dashboard.</li>
            <li>Only simple results are kept, like &ldquo;slouch detected&rdquo;, for your wellness score.</li>
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-2">
          <video ref={videoRef} muted playsInline className={clsx("h-full w-full -scale-x-100 object-cover", !active && "hidden")} />
          {!active && <span className="text-xs text-muted">{starting ? "Starting camera…" : "Camera preview will appear here"}</span>}
          {active && (
            <div
              className={clsx(
                "absolute left-2 top-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white",
                paused ? "bg-black/60" : "bg-danger/90"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
              {paused ? "Paused — camera still on" : "Camera on · analysing locally"}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <PostureLivePanel />

          <div className="flex flex-wrap items-center gap-2">
            {!active ? (
              <button
                onClick={start}
                disabled={starting}
                className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
              >
                {starting ? "Starting…" : "Start monitoring"}
              </button>
            ) : (
              <>
                {running ? (
                  <button onClick={pause} className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-surface-2">
                    <Icon name="action.pause" size={16} /> Pause
                  </button>
                ) : (
                  <button onClick={resume} className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-black hover:opacity-90">
                    <Icon name="action.play" size={16} /> Resume
                  </button>
                )}
                <button onClick={stop} className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-surface-2">
                  <Icon name="action.stop" size={16} /> Stop &amp; turn camera off
                </button>
              </>
            )}
          </div>

          {active && (
            <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={calibrate}
                  disabled={!canCalibrate || calibrating}
                  className="flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 font-medium text-foreground hover:bg-surface-2 disabled:opacity-50"
                >
                  <Icon name="action.calibrate" size={14} />
                  {calibrating ? "Calibrating — hold your comfortable upright posture…" : calibration ? "Recalibrate" : "Calibrate to my posture"}
                </button>
                {calibration && !calibrating && (
                  <button onClick={() => setCalibration(null)} className="min-h-9 px-2 font-medium text-muted hover:text-foreground">
                    Reset calibration
                  </button>
                )}
              </div>
              <p className="mt-1.5">
                {canCalibrate || calibrating
                  ? "Sit (or stand) comfortably upright facing your screen, then calibrate. This adapts the checks to your camera's position."
                  : "Calibration is available once you're sitting or standing in view."}
              </p>
            </div>
          )}

          <PostureGazeStatus />

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>Monitoring: {formatDuration(active ? monitoringStartedAt : null)}</span>
            <span>Slouch events today: {slouchEventsToday}</span>
          </div>
        </div>
      </div>

      {sessionError && <CameraUnavailablePanel error={sessionError} onRetry={start} />}

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>Posture Score</span>
          <span className="tabular-nums text-foreground">{scores.posture}</span>
        </div>
        <ProgressBar value={scores.posture} tone={scores.posture < 60 ? "critical" : scores.posture < 80 ? "warning" : "good"} />
      </div>

      {prolongedGaze && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          <span>You&apos;ve been sitting with low screen angle for a while. Consider a UrgeSurfer reset, or a short walk.</span>
          <Link
            href="/move/walk"
            className="shrink-0 rounded-full bg-warning/20 px-3 py-1.5 text-xs font-semibold text-warning hover:bg-warning/30"
          >
            Take a 15-minute walk?
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => logEvent("posture_corrected")}
          className="rounded-full bg-accent/15 px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/25"
        >
          Log Posture Correction
        </button>
        <button
          onClick={() => logEvent("focus_session_completed")}
          className="rounded-full bg-accent/15 px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/25"
        >
          Log Focus Session Complete
        </button>
      </div>

      <div className="text-xs text-muted">
        {lastPostureCorrectionAt ? `Last correction ${minutesAgoLabel(lastPostureCorrectionAt, now)}` : "No corrections yet"}
      </div>

      <ActivityExplorer />
    </div>
  );
}
