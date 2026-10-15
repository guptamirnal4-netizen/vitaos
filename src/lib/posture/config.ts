import type { RuleSetKey } from "./types";

/**
 * Every tunable number for activity-aware posture detection lives here.
 *
 * These are heuristic starting points for a consumer wellness nudge, NOT
 * clinically validated limits. Rationale for the initial values:
 * - Screen viewing: common office-ergonomics guidance (e.g. OSHA's computer
 *   workstation eTool, ISO 9241-5) puts the top of the screen at or slightly
 *   below eye level, with a comfortable viewing angle roughly 15–20° below
 *   horizontal. Sustained head flexion well past that is what we nudge on.
 * - Phone use: biomechanical modelling (Hansraj, Surgical Technology
 *   International, 2014) estimates neck load rising steeply from ~15° to 45–60°
 *   of flexion. Looking down at a phone is normal, so phone rules allow more
 *   flexion and need it to persist longer than laptop rules do.
 * - Webcams see the person from the front: "forward head" is estimated from
 *   proxies (ear-to-shoulder height shrinking, head pitch), not measured from
 *   the side. Calibrating to the user's own upright posture makes this far
 *   more reliable than the absolute defaults.
 */

export const LANDMARK_CONFIG = {
  /** A landmark counts as visible at or above this MediaPipe visibility score. */
  MIN_VISIBILITY: 0.6,
  /** Wrist within this many shoulder widths of the nose counts as "near the face". */
  WRIST_NEAR_FACE_SW: 0.9,
};

export const ACTIVITY_CONFIG = {
  /** Torso/head axis this far from vertical (degrees) reads as lying down. */
  LYING_AXIS_DEG: 60,
  /** Upright torso: within this many degrees of vertical. */
  UPRIGHT_TORSO_DEG: 30,
  /** Thigh this far from vertical reads as seated; below STANDING_THIGH_DEG as standing. */
  SEATED_THIGH_DEG: 50,
  STANDING_THIGH_DEG: 25,
  /** Upper body this large in frame (shoulder width / frame width) and hips out of view ≈ sitting at a screen. */
  CLOSE_FRAMING_SHOULDER_WIDTH: 0.22,
  /** Frames considered by the smoother (~3 s at the default inference rate). */
  WINDOW_FRAMES: 8,
  /** A new state must average at least this confidence over the window to replace the current one. */
  SWITCH_CONFIDENCE: 0.55,
  /** …and must have been the leading candidate for this long (hysteresis against flicker). */
  MIN_DWELL_MS: 2_500,
  /** Losing sight of the person must last this long before switching to INSUFFICIENT_VISIBILITY. */
  VISIBILITY_GRACE_MS: 2_000,
  /**
   * POSSIBLE_SLEEP needs ALL of: lying down this long, almost no movement,
   * and eyes closed (face model) for EYES_CLOSED_MS. Stillness alone never counts.
   */
  SLEEP_MIN_LYING_MS: 3 * 60_000,
  SLEEP_EYES_CLOSED_MS: 60_000,
  /** Sitting with eyes closed this long (blinks reset it) reads as dozing off in the chair. */
  SEATED_DOZE_EYES_MS: 30_000,
  SLEEP_EYES_CLOSED_SCORE: 0.6,
  /** Mean anchor movement per frame (in shoulder widths) below which the body counts as still. */
  STILL_MOVEMENT_SW: 0.02,
};

export const DEVICE_CONFIG = {
  /** Camera evidence considered for automatic switching (~15 s at the default rate). */
  WINDOW_FRAMES: 36,
  /** Automatic switching needs at least this many evidence frames… */
  MIN_EVIDENCE_FRAMES: 20,
  /** …and this share of them pointing the same way. Weak or mixed evidence never switches. */
  SWITCH_SHARE: 0.75,
  /** Head pitched at least this far down with a hand up near the face is phone evidence. */
  PHONE_PITCH_DEG: 25,
  /** Running on a touch-first device is only a weak prior, never proof (it says nothing about what the person holds). */
  TOUCH_DEVICE_PRIOR: 0.35,
};

export interface RuleSet {
  label: string;
  /** Head pitched down beyond this (degrees, relative to calibration when available). */
  headDownDeg: number;
  /** "moderate" severity beyond this. */
  headDownSevereDeg: number;
  /** Neck height below this share of the calibrated baseline counts as forward head / slumping. */
  neckHeightMinShare: number;
  /** Without calibration, neck height below this many shoulder widths counts. */
  neckHeightMinAbsolute: number;
  headTiltDeg: number;
  shoulderAsymmetry: number;
  /** null = torso lean isn't judged for this context. */
  torsoLeanDeg: number | null;
  /** Only used for lying down: neck bent relative to the torso. */
  neckBendDeg: number | null;
  /** Rules that apply; anything not listed is skipped (e.g. no desk rules while lying down). */
  checks: ReadonlyArray<"headDown" | "forwardHead" | "headTilt" | "shoulders" | "torsoLean" | "neckBend">;
  /** How long an issue must persist before a nudge, before the sensitivity multiplier. */
  persistMs: number;
}

export const RULE_SETS: Record<RuleSetKey, RuleSet> = {
  LAPTOP_SEATED: {
    label: "Laptop, seated",
    headDownDeg: 20,
    headDownSevereDeg: 32,
    neckHeightMinShare: 0.82,
    neckHeightMinAbsolute: 0.42,
    headTiltDeg: 15,
    shoulderAsymmetry: 0.09,
    torsoLeanDeg: 20,
    neckBendDeg: null,
    checks: ["headDown", "forwardHead", "headTilt", "shoulders", "torsoLean"],
    persistMs: 12_000,
  },
  GENERAL_SEATED: {
    label: "Seated",
    headDownDeg: 25,
    headDownSevereDeg: 38,
    neckHeightMinShare: 0.8,
    neckHeightMinAbsolute: 0.4,
    headTiltDeg: 18,
    shoulderAsymmetry: 0.1,
    torsoLeanDeg: 22,
    neckBendDeg: null,
    checks: ["headDown", "forwardHead", "headTilt", "shoulders", "torsoLean"],
    persistMs: 15_000,
  },
  PHONE: {
    label: "Phone",
    headDownDeg: 32,
    headDownSevereDeg: 45,
    neckHeightMinShare: 0.72,
    neckHeightMinAbsolute: 0.35,
    headTiltDeg: 20,
    shoulderAsymmetry: 0.12,
    torsoLeanDeg: null,
    neckBendDeg: null,
    checks: ["headDown", "forwardHead", "headTilt"],
    persistMs: 20_000,
  },
  STANDING: {
    label: "Standing",
    headDownDeg: 30,
    headDownSevereDeg: 42,
    neckHeightMinShare: 0.8,
    neckHeightMinAbsolute: 0.4,
    headTiltDeg: 15,
    shoulderAsymmetry: 0.09,
    torsoLeanDeg: 15,
    neckBendDeg: null,
    checks: ["headDown", "headTilt", "shoulders", "torsoLean"],
    persistMs: 15_000,
  },
  LYING: {
    label: "Lying down",
    headDownDeg: 90,
    headDownSevereDeg: 90,
    neckHeightMinShare: 0,
    neckHeightMinAbsolute: 0,
    headTiltDeg: 90,
    shoulderAsymmetry: 1,
    torsoLeanDeg: null,
    neckBendDeg: 40,
    checks: ["neckBend"],
    persistMs: 60_000,
  },
  /**
   * Dozing or resting. Resting itself is never a fault; only a neck left
   * hanging (head dropped forward or tipped hard to one side while dozing in a
   * chair, or sharply bent while lying) is flagged. Lying down only uses the
   * neck-bend check, because head angles relative to the camera mean nothing
   * when the whole body is horizontal.
   */
  RESTING: {
    label: "Resting",
    headDownDeg: 35,
    headDownSevereDeg: 50,
    neckHeightMinShare: 0,
    neckHeightMinAbsolute: 0,
    headTiltDeg: 25,
    shoulderAsymmetry: 1,
    torsoLeanDeg: null,
    neckBendDeg: 40,
    checks: ["headDown", "headTilt", "neckBend"],
    persistMs: 20_000,
  },
};

export const ALERT_CONFIG = {
  /** Posture back within limits for this long clears an active warning. */
  RECOVERY_MS: 2_000,
  /** Below this evaluation confidence nothing is judged and nothing is alerted. */
  MIN_CONFIDENCE: 0.5,
  /** Short dropouts (a hand in front of the face) don't wipe a building episode. */
  LOW_CONFIDENCE_GRACE_MS: 2_000,
  /** Suggest a movement break after this long evaluated in one position without moving much. */
  STATIC_BREAK_MS: 40 * 60_000,
  /**
   * "Alert as soon as my posture isn't optimal" (Settings): a short debounce
   * instead of the per-context persistence, so a momentary flicker at a
   * threshold doesn't fire, but real slouching does within seconds.
   */
  INSTANT_PERSIST_MS: 3_000,
  /** In instant mode every new episode notifies, but never more often than this. */
  INSTANT_MIN_GAP_MS: 10_000,
  /** Same multipliers as the existing posture nudges (Settings → Alert sensitivity). */
  SENSITIVITY_MULTIPLIER: { low: 1.5, medium: 1, high: 0.6 } as const,
};

export const SESSION_CONFIG = {
  /** ~2.5 inferences per second: responsive enough for posture, light on the CPU. */
  INFERENCE_INTERVAL_MS: 400,
  /** Consecutive failed frames before the session reports a model problem. */
  MAX_CONSECUTIVE_FAILURES: 15,
  /** Calibration averages this many good frames. */
  CALIBRATION_FRAMES: 8,
};
