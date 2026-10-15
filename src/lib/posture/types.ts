/**
 * Shared contracts for activity-aware posture detection.
 *
 * Pipeline (each stage is a separate, pure module):
 *   landmarks → features → activity classification → device context
 *   → context-specific posture evaluation → temporal validation → feedback.
 *
 * Nothing here touches the DOM or the camera, so every stage is unit-tested
 * with deterministic landmarks (tests/unit/posture/*).
 */

/** What the body is doing. UNKNOWN and INSUFFICIENT_VISIBILITY are valid answers, not errors. */
export type ActivityState = "SITTING" | "STANDING" | "LYING_DOWN" | "POSSIBLE_SLEEP" | "UNKNOWN" | "INSUFFICIENT_VISIBILITY";

/** What the person is looking at / working on. Separate from body position. */
export type DeviceContext = "LAPTOP" | "PHONE" | "OTHER" | "UNKNOWN";

/** What the user picked in the selector. AUTO lets strong camera evidence decide. */
export type DeviceSelection = "AUTO" | "LAPTOP" | "PHONE" | "OTHER";

/** One MediaPipe landmark, normalized to the frame (0..1); visibility 0..1 when the model provides it. */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** Head orientation from the face model, in degrees. */
export interface FaceSignals {
  /** Absolute head pitch away from facing the camera straight on (at a screen this is usually looking down). */
  pitchDeg: number;
  /** Absolute sideways roll (ear towards shoulder). */
  rollDeg: number;
  /** Absolute left/right turn away from the camera. */
  yawDeg: number;
  /** 0..1, averaged over both eyes; null when blendshapes are unavailable. */
  eyesClosed: number | null;
}

/**
 * Geometry derived from one frame. Every measurement is null when the
 * landmarks it needs weren't visible enough — never a guessed value.
 * Distances are in shoulder widths, so they don't depend on how far the
 * person sits from the camera.
 */
export interface BodyFeatures {
  visibility: {
    head: boolean;
    shoulders: boolean;
    hips: boolean;
    knees: boolean;
    wrists: boolean;
    /** Mean visibility of the landmarks used, 0..1. */
    score: number;
  };
  /** Shoulder-to-shoulder distance in frame widths (how close the person is). */
  shoulderWidth: number | null;
  /** Vertical ear-to-shoulder gap, in shoulder widths. Shrinks when the head drops forward or the person slumps. */
  neckHeightRatio: number | null;
  /** Shoulder height difference, in shoulder widths. */
  shoulderAsymmetry: number | null;
  /** Shoulder→hip line, degrees from vertical (0 upright, 90 horizontal). */
  torsoAngleDeg: number | null;
  /** Hip→knee line, degrees from vertical (≈0 standing, ≈90 seated thighs). */
  thighAngleDeg: number | null;
  /** Head→shoulder line, degrees from vertical; used when hips are out of frame. */
  headAxisAngleDeg: number | null;
  /** Angle between the head axis and the torso axis (neck bend), degrees. */
  neckBendDeg: number | null;
  /** A wrist is raised close to the face (e.g. holding a phone up). */
  wristNearFace: boolean | null;
  /** A wrist is below the face but in front of the chest (e.g. holding a phone low). */
  wristInFrontOfChest: boolean | null;
  /** Head orientation from the face model, when a face was found. */
  face: FaceSignals | null;
  /** Mid-shoulder point, for motion tracking between frames. */
  anchor: { x: number; y: number } | null;
}

export interface ActivityEstimate {
  state: ActivityState;
  /** 0..1 */
  confidence: number;
  /** True when inferred from typical framing rather than seeing the hips/knees (e.g. "seated" at a webcam). */
  estimated: boolean;
  reason: string;
}

export interface DeviceContextEstimate {
  context: DeviceContext;
  source: "user" | "camera" | "default";
  confidence: number;
}

/** The rule set chosen for the current activity + device. */
export type RuleSetKey = "LAPTOP_SEATED" | "PHONE" | "GENERAL_SEATED" | "STANDING" | "LYING";

export type PostureIssueCode =
  | "HEAD_DOWN"
  | "FORWARD_HEAD"
  | "HEAD_TILT"
  | "SHOULDER_ASYMMETRY"
  | "TORSO_LEAN"
  | "NECK_BENT";

export interface PostureIssue {
  code: PostureIssueCode;
  severity: "mild" | "moderate";
  /** Short, actionable correction, phrased for the current context. */
  message: string;
  value: number;
  threshold: number;
}

export interface PostureMetric {
  key: "headPitch" | "neckHeight" | "headTilt" | "shoulderAsymmetry" | "torsoLean" | "neckBend";
  label: string;
  /** null = not measurable right now (landmarks hidden). */
  value: number | null;
  unit: "°" | "%";
  limit: number;
  ok: boolean | null;
}

export type PostureStatus = "GOOD" | "ADJUST" | "NOT_EVALUATED";

export interface PostureEvaluation {
  activity: ActivityState;
  device: DeviceContext;
  ruleSet: RuleSetKey | null;
  status: PostureStatus;
  /** Why it wasn't evaluated, when status is NOT_EVALUATED. */
  notEvaluatedReason: string | null;
  issues: PostureIssue[];
  metrics: PostureMetric[];
  /** The single most useful correction right now, or null when posture looks fine. */
  recommendation: string | null;
  /** 0..1: landmark visibility combined with activity confidence. */
  confidence: number;
}

/** A per-user baseline captured while sitting comfortably upright; adapts the rules to camera placement. */
export interface PostureCalibration {
  neckHeightRatio: number;
  pitchDeg: number;
  capturedAt: number;
}
