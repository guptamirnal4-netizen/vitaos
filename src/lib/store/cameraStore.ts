"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { registerUserScopedStore, userScopedStorage } from "./userScopedStorage";
import { NUDGE_CONFIG, NudgeKind, NudgeState } from "@/lib/camera/postureNudges";
import type {
  ActivityEstimate,
  DeviceContextEstimate,
  DeviceSelection,
  PostureCalibration,
  PostureEvaluation,
  PostureIssueCode,
} from "@/lib/posture/types";
import type { SessionError, SessionState } from "@/lib/posture/session";

export type CameraPermissionState =
  | "unknown"
  | "granted"
  | "denied"
  | "unavailable"
  | "insecure-context";

export type PostureStatus = "optimal" | "mild" | "elevated-risk";

/** The nudge currently on screen; posture + gaze close together merge into "both". */
export interface ActiveNudge {
  id: number;
  kind: NudgeKind | "both";
  at: number;
  /** Context-specific copy from the posture engine; falls back to NUDGE_MESSAGES. */
  title?: string;
  body?: string;
}

/** Counts for the current monitoring session (derived only — no images, no landmarks). */
export interface PostureSessionStats {
  warnings: number;
  recoveries: number;
  issues: Partial<Record<PostureIssueCode, number>>;
}

const EMPTY_STATS: PostureSessionStats = { warnings: 0, recoveries: 0, issues: {} };

interface CameraState {
  permission: CameraPermissionState;
  monitoring: boolean;
  monitoringStartedAt: number | null;

  eyeLevelAngle: number | null;
  headTilt: number | null;
  headTurn: number | null;
  postureStatus: PostureStatus | null;
  slouchEventsToday: number;

  postureNudgeState: NudgeState;
  gazeNudgeState: NudgeState;
  activeNudge: ActiveNudge | null;
  /** Opt-in: also show a system notification when the app window isn't focused. */
  systemNotifications: boolean;

  // Activity-aware posture (lib/posture). Live values change at most once per inference tick.
  sessionState: SessionState;
  sessionError: SessionError | null;
  activity: ActivityEstimate | null;
  device: DeviceContextEstimate | null;
  evaluation: PostureEvaluation | null;
  /** Persisted: Auto / Laptop / Phone / Other. */
  deviceSelection: DeviceSelection;
  /** Persisted per user: the upright baseline that adapts rules to their camera placement. */
  calibration: PostureCalibration | null;
  calibrating: boolean;
  sessionStats: PostureSessionStats;


  alertsEnabled: boolean;
  gazeAlertsEnabled: boolean;
  alertSensitivity: "low" | "medium" | "high";
  alertCooldownMinutes: number;
  lastAlertAt: number | null;

  setPermission: (p: CameraPermissionState) => void;
  setMonitoring: (on: boolean) => void;
  updateMetrics: (m: Partial<Pick<CameraState, "eyeLevelAngle" | "headTilt" | "headTurn" | "postureStatus">>) => void;
  setNudgeStates: (posture: NudgeState, gaze: NudgeState) => void;
  pushNudge: (kind: NudgeKind, copy?: { title: string; body: string }) => ActiveNudge;
  setSession: (state: SessionState, error: SessionError | null) => void;
  /** Applies a tick's results, skipping the update when nothing visible changed. */
  setLive: (live: { activity: ActivityEstimate | null; device: DeviceContextEstimate | null; evaluation: PostureEvaluation | null }) => void;
  setDeviceSelection: (selection: DeviceSelection) => void;
  setCalibration: (calibration: PostureCalibration | null) => void;
  setCalibrating: (on: boolean) => void;
  recordSessionEvent: (type: "warning" | "recovered", issue?: PostureIssueCode) => void;
  dismissNudge: () => void;
  setSystemNotifications: (on: boolean) => void;
  registerSlouchEvent: () => void;
  setAlertsEnabled: (on: boolean) => void;
  setGazeAlertsEnabled: (on: boolean) => void;
  setAlertSensitivity: (s: CameraState["alertSensitivity"]) => void;
  setAlertCooldownMinutes: (m: number) => void;
  markAlertFired: () => void;
  canFireAlert: () => boolean;
}

export const useCameraStore = create<CameraState>()(
  persist(
    (set, get) => ({
      permission: "unknown",
      monitoring: false,
      monitoringStartedAt: null,

      eyeLevelAngle: null,
      headTilt: null,
      headTurn: null,
      postureStatus: null,
      slouchEventsToday: 0,

      postureNudgeState: "no-detection",
      gazeNudgeState: "no-detection",
      activeNudge: null,
      systemNotifications: false,

      sessionState: "idle",
      sessionError: null,
      activity: null,
      device: null,
      evaluation: null,
      deviceSelection: "AUTO",
      calibration: null,
      calibrating: false,
      sessionStats: EMPTY_STATS,


      alertsEnabled: true,
      gazeAlertsEnabled: true,
      alertSensitivity: "medium",
      alertCooldownMinutes: 1, // "Remind again every" — also spaces separate episodes
      lastAlertAt: null,

      setPermission: (permission) => set({ permission }),
      setMonitoring: (monitoring) =>
        set((state) => ({
          monitoring,
          // Pausing keeps the session's start time; only a fresh start resets it.
          monitoringStartedAt: monitoring ? (state.monitoringStartedAt ?? Date.now()) : null,
          sessionStats: monitoring ? state.sessionStats : EMPTY_STATS,
          ...(monitoring ? {} : { activity: null, device: null, evaluation: null, calibrating: false }),
        })),
      updateMetrics: (m) => set(m),
      setNudgeStates: (postureNudgeState, gazeNudgeState) => {
        const s = get();
        if (s.postureNudgeState !== postureNudgeState || s.gazeNudgeState !== gazeNudgeState) {
          set({ postureNudgeState, gazeNudgeState });
        }
      },
      pushNudge: (kind, copy) => {
        const now = Date.now();
        const current = get().activeNudge;
        const merge = current !== null && current.kind !== kind && now - current.at < NUDGE_CONFIG.NUDGE_VISIBLE_MS;
        // Merged posture+gaze nudges use the shared "Quick reset" copy instead of one context's message.
        const next: ActiveNudge = { id: (current?.id ?? 0) + 1, kind: merge ? "both" : kind, at: now, ...(merge ? {} : copy) };
        set({ activeNudge: next });
        return next;
      },
      dismissNudge: () => set({ activeNudge: null }),
      setSession: (sessionState, sessionError) => set({ sessionState, sessionError }),
      setLive: (live) => {
        const s = get();
        if (liveKey(s) !== liveKey(live)) set(live);
      },
      setDeviceSelection: (deviceSelection) => set({ deviceSelection }),
      setCalibration: (calibration) => set({ calibration, calibrating: false }),
      setCalibrating: (calibrating) => set({ calibrating }),
      recordSessionEvent: (type, issue) =>
        set((state) => {
          const stats = state.sessionStats;
          if (type === "recovered") return { sessionStats: { ...stats, recoveries: stats.recoveries + 1 } };
          const issues = issue ? { ...stats.issues, [issue]: (stats.issues[issue] ?? 0) + 1 } : stats.issues;
          return { sessionStats: { ...stats, warnings: stats.warnings + 1, issues } };
        }),
      setSystemNotifications: (systemNotifications) => set({ systemNotifications }),
      registerSlouchEvent: () =>
        set((state) => ({ slouchEventsToday: state.slouchEventsToday + 1 })),
      setAlertsEnabled: (alertsEnabled) => set({ alertsEnabled }),
      setGazeAlertsEnabled: (gazeAlertsEnabled) => set({ gazeAlertsEnabled }),
      setAlertSensitivity: (alertSensitivity) => set({ alertSensitivity }),
      setAlertCooldownMinutes: (alertCooldownMinutes) => set({ alertCooldownMinutes }),
      markAlertFired: () => set({ lastAlertAt: Date.now() }),
      canFireAlert: () => {
        const { lastAlertAt, alertCooldownMinutes } = get();
        if (!lastAlertAt) return true;
        return Date.now() - lastAlertAt >= alertCooldownMinutes * 60_000;
      },
    }),
    {
      name: "vitaos-camera-store",
      storage: userScopedStorage,
      version: 1,
      // v0 used a 3-minute one-off cooldown; reminders now repeat, so move the old default to 1 minute.
      migrate: (persisted, version) => {
        const state = persisted as Partial<CameraState>;
        if (version < 1 && state.alertCooldownMinutes === 3) state.alertCooldownMinutes = 1;
        return state as CameraState;
      },
      partialize: (state) => ({
        alertsEnabled: state.alertsEnabled,
        gazeAlertsEnabled: state.gazeAlertsEnabled,
        alertSensitivity: state.alertSensitivity,
        alertCooldownMinutes: state.alertCooldownMinutes,
        systemNotifications: state.systemNotifications,
        deviceSelection: state.deviceSelection,
        calibration: state.calibration,
      }),
    }
  )
);

registerUserScopedStore(useCameraStore);

/** What the UI shows from a tick; rounding keeps tiny metric jitter from re-rendering. */
function liveKey(l: { activity: ActivityEstimate | null; device: DeviceContextEstimate | null; evaluation: PostureEvaluation | null }): string {
  const e = l.evaluation;
  return JSON.stringify([
    l.activity?.state,
    l.activity?.estimated,
    Math.round((l.activity?.confidence ?? 0) * 10),
    l.device?.context,
    l.device?.source,
    e?.status,
    e?.ruleSet,
    e?.recommendation,
    e?.notEvaluatedReason,
    e?.issues.map((i) => i.code + i.severity),
    e?.metrics.map((m) => `${m.key}:${m.value}:${m.ok}`),
  ]);
}
