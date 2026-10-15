"use client";

import clsx from "clsx";
import { useCameraStore } from "@/lib/store/cameraStore";
import { Icon, IconName } from "@/components/ui/Icon";
import { RULE_SETS } from "@/lib/posture/config";
import type { ActivityState, DeviceContext, DeviceSelection } from "@/lib/posture/types";

const ACTIVITY: Record<ActivityState, { label: string; icon: IconName }> = {
  SITTING: { label: "Sitting", icon: "posture.sitting" },
  STANDING: { label: "Standing", icon: "posture.standing" },
  LYING_DOWN: { label: "Lying down", icon: "posture.lying" },
  // Never presented as confirmed sleep.
  POSSIBLE_SLEEP: { label: "Lying down or resting", icon: "posture.resting" },
  UNKNOWN: { label: "Working out your position…", icon: "posture.unknown" },
  INSUFFICIENT_VISIBILITY: { label: "Can't see you clearly", icon: "posture.hidden" },
};

const DEVICE_LABEL: Record<DeviceContext, string> = { LAPTOP: "Laptop", PHONE: "Phone", OTHER: "General activity", UNKNOWN: "Not sure yet" };
const DEVICE_ICON: Record<DeviceContext, IconName> = { LAPTOP: "device.laptop", PHONE: "device.phone", OTHER: "device.other", UNKNOWN: "posture.unknown" };

const SELECTIONS: { key: DeviceSelection; label: string }[] = [
  { key: "AUTO", label: "Auto" },
  { key: "LAPTOP", label: "Laptop" },
  { key: "PHONE", label: "Phone" },
  { key: "OTHER", label: "General" },
];

function confidenceLabel(c: number): string {
  return c >= 0.75 ? "high" : c >= 0.55 ? "medium" : "low";
}

/**
 * What the posture engine sees right now: body position, device context,
 * posture status and one clear correction. Raw metrics live in an optional
 * "Details" section so the default view stays understandable.
 */
export function PostureLivePanel() {
  const sessionState = useCameraStore((s) => s.sessionState);
  const activity = useCameraStore((s) => s.activity);
  const device = useCameraStore((s) => s.device);
  const evaluation = useCameraStore((s) => s.evaluation);
  const selection = useCameraStore((s) => s.deviceSelection);
  const setSelection = useCameraStore((s) => s.setDeviceSelection);
  const stats = useCameraStore((s) => s.sessionStats);
  const calibration = useCameraStore((s) => s.calibration);

  const live = sessionState === "running";
  const paused = sessionState === "paused";
  const act = activity ? ACTIVITY[activity.state] : null;

  const status = !live
    ? { tone: "idle", title: paused ? "Paused" : "Not monitoring", body: paused ? "Posture isn't being checked. Resume when you're ready." : "Start monitoring to get live posture feedback." }
    : !evaluation || evaluation.status === "NOT_EVALUATED"
      ? { tone: "idle", title: "Not judging posture right now", body: evaluation?.notEvaluatedReason ?? "Getting a clear view…" }
      : evaluation.status === "GOOD"
        ? { tone: "good", title: "Posture looks good", body: "Nice. Nothing to adjust right now." }
        : { tone: "adjust", title: "Small adjustment", body: evaluation.recommendation ?? "Adjust your position slightly." };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="text-xs text-muted">Position</div>
          <div className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground" aria-live="polite">
            {live && act ? (
              <>
                <Icon name={act.icon} size={18} className="text-accent-foreground" />
                <span>
                  {act.label}
                  {activity?.estimated && activity.state !== "POSSIBLE_SLEEP" ? " (estimated)" : ""}
                </span>
              </>
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>
          {live && activity && activity.state !== "UNKNOWN" && activity.state !== "INSUFFICIENT_VISIBILITY" && (
            <div className="mt-0.5 text-xs text-muted">Confidence: {confidenceLabel(activity.confidence)}</div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="text-xs text-muted">What are you using?</div>
          <div role="radiogroup" aria-label="Device you're using" className="mt-1.5 flex flex-wrap gap-1">
            {SELECTIONS.map((s) => (
              <button
                key={s.key}
                role="radio"
                aria-checked={selection === s.key}
                onClick={() => setSelection(s.key)}
                className={clsx(
                  "min-h-9 rounded-full px-3 text-xs font-medium transition-colors",
                  selection === s.key ? "bg-accent text-black" : "bg-surface-2 text-muted hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {selection !== "AUTO" ? (
            // An explicit choice applies immediately; it doesn't wait for the next camera frame.
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              <Icon name={DEVICE_ICON[selection]} size={14} />
              Using {DEVICE_LABEL[selection].toLowerCase()} rules
            </div>
          ) : (
            live &&
            device && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                <Icon name={DEVICE_ICON[device.context]} size={14} />
                {device.source === "camera"
                  ? `Detected: ${DEVICE_LABEL[device.context]}`
                  : device.context === "UNKNOWN"
                    ? "Not sure yet — pick one if Auto guesses wrong"
                    : `Assuming ${DEVICE_LABEL[device.context].toLowerCase()} (this device) — pick one if that's wrong`}
              </div>
            )
          )}
        </div>
      </div>

      <div
        aria-live="polite"
        className={clsx(
          "rounded-xl border p-4",
          status.tone === "good" && "border-success/40 bg-success/10",
          status.tone === "adjust" && "border-warning/40 bg-warning/10",
          status.tone === "idle" && "border-border bg-surface"
        )}
      >
        <div className="text-sm font-semibold text-foreground">{status.title}</div>
        <div className="mt-0.5 text-sm text-muted">{status.body}</div>
        {live && evaluation?.ruleSet && (
          <div className="mt-2 text-xs text-muted">
            Checking with {RULE_SETS[evaluation.ruleSet].label.toLowerCase()} rules
            {calibration ? " · calibrated to you" : " · not calibrated"}
          </div>
        )}
      </div>

      {(live || paused) && (
        <details className="rounded-xl border border-border bg-surface p-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted">Details</summary>
          <dl className="mt-3 grid gap-2">
            {(evaluation?.metrics ?? []).map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-3 text-xs">
                <dt className="text-muted">{m.label}</dt>
                <dd className={clsx("tabular-nums", m.ok === false ? "font-semibold text-warning" : "text-foreground")}>
                  {m.value === null ? "not visible" : `${m.value}${m.unit}`}
                  <span className="text-muted">
                    {" "}
                    (limit {m.key === "neckHeight" ? "≥" : "≤"} {m.limit}
                    {m.unit})
                  </span>
                </dd>
              </div>
            ))}
            {evaluation && (
              <div className="flex items-center justify-between gap-3 text-xs">
                <dt className="text-muted">Reading confidence</dt>
                <dd className="tabular-nums text-foreground">{Math.round(evaluation.confidence * 100)}%</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 text-xs">
              <dt className="text-muted">This session</dt>
              <dd className="text-foreground">
                {stats.warnings} {stats.warnings === 1 ? "nudge" : "nudges"} · {stats.recoveries} {stats.recoveries === 1 ? "correction" : "corrections"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            These are camera estimates for gentle reminders, not a medical assessment. A front-facing webcam can&apos;t see your spine;
            &ldquo;forward head&rdquo; is estimated from how your head sits relative to your shoulders.
          </p>
        </details>
      )}
    </div>
  );
}
