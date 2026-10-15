import { ACTIVITY_CONFIG } from "./config";
import type { ActivityEstimate, ActivityState, BodyFeatures } from "./types";

/**
 * Body position from ONE frame. Deliberately conservative: when the evidence
 * isn't there it answers UNKNOWN or INSUFFICIENT_VISIBILITY instead of
 * guessing. Never returns POSSIBLE_SLEEP — that needs time (see ActivitySmoother).
 */
export function classifyFrame(f: BodyFeatures, config = ACTIVITY_CONFIG): ActivityEstimate {
  const v = f.visibility;
  if (!v.shoulders && !(v.head && f.face)) {
    return { state: "INSUFFICIENT_VISIBILITY", confidence: 0.9, estimated: false, reason: "Head and shoulders aren't visible" };
  }

  // Lying down: the body axis (shoulders→hips, or head→shoulders when hips are out of frame) is near horizontal.
  const axis = f.torsoAngleDeg ?? f.headAxisAngleDeg;
  if (axis !== null && axis >= config.LYING_AXIS_DEG) {
    const confidence = clamp01(0.55 + ((axis - config.LYING_AXIS_DEG) / (90 - config.LYING_AXIS_DEG)) * 0.35 + (f.torsoAngleDeg !== null ? 0.1 : 0));
    return { state: "LYING_DOWN", confidence, estimated: f.torsoAngleDeg === null, reason: "Body is close to horizontal" };
  }

  const upright = f.torsoAngleDeg === null || f.torsoAngleDeg <= config.UPRIGHT_TORSO_DEG;

  // Hips and knees visible: the thigh angle separates sitting from standing reliably.
  if (f.thighAngleDeg !== null && v.hips) {
    if (f.thighAngleDeg >= config.SEATED_THIGH_DEG) {
      return { state: "SITTING", confidence: 0.85, estimated: false, reason: "Thighs are close to horizontal" };
    }
    if (f.thighAngleDeg <= config.STANDING_THIGH_DEG && upright) {
      return { state: "STANDING", confidence: 0.85, estimated: false, reason: "Legs and torso are upright" };
    }
    return { state: "UNKNOWN", confidence: 0.4, estimated: false, reason: "Legs are between sitting and standing" };
  }

  // Typical webcam framing: head and shoulders large in frame, hips out of view.
  // That is what sitting at a screen looks like — but a standing desk looks the
  // same, so it's marked as estimated and kept below "seen" confidence.
  if (v.shoulders && !v.hips && upright && f.shoulderWidth !== null && f.shoulderWidth >= config.CLOSE_FRAMING_SHOULDER_WIDTH) {
    return { state: "SITTING", confidence: 0.6, estimated: true, reason: "Upper body close to the camera, like sitting at a screen" };
  }

  // Hips visible, upright torso, but no knees: standing far from the camera, or sitting low. Not enough to say.
  return { state: "UNKNOWN", confidence: 0.35, estimated: false, reason: "Not enough of the body is visible to tell" };
}

interface Frame {
  at: number;
  estimate: ActivityEstimate;
  movement: number | null;
  eyesClosed: number | null;
}

/**
 * Smooths per-frame estimates into a stable activity:
 * - a new state must win the recent window with enough confidence AND stay
 *   the leading candidate for MIN_DWELL_MS before it replaces the current one
 *   (hysteresis — no flicker between sitting and unknown at a threshold);
 * - losing sight of the person only counts after VISIBILITY_GRACE_MS;
 * - POSSIBLE_SLEEP is a cautious inference layered on LYING_DOWN that needs
 *   long lying + near stillness + eyes closed. Stillness alone is never sleep.
 */
export class ActivitySmoother {
  private frames: Frame[] = [];
  private current: ActivityEstimate = { state: "UNKNOWN", confidence: 0, estimated: false, reason: "Starting" };
  private candidate: { state: ActivityState; since: number } | null = null;
  private lyingSince: number | null = null;
  private eyesClosedSince: number | null = null;
  private lastAnchor: { x: number; y: number; sw: number } | null = null;

  constructor(private config = ACTIVITY_CONFIG) {}

  get state(): ActivityEstimate {
    return this.current;
  }

  reset() {
    this.frames = [];
    this.current = { state: "UNKNOWN", confidence: 0, estimated: false, reason: "Starting" };
    this.candidate = null;
    this.lyingSince = null;
    this.eyesClosedSince = null;
    this.lastAnchor = null;
  }

  update(now: number, features: BodyFeatures): ActivityEstimate {
    const estimate = classifyFrame(features, this.config);
    const movement = this.movement(features);
    this.frames.push({ at: now, estimate, movement, eyesClosed: features.face?.eyesClosed ?? null });
    if (this.frames.length > this.config.WINDOW_FRAMES) this.frames.shift();

    const leader = this.leader();
    const dwellMs = leader.state === "INSUFFICIENT_VISIBILITY" ? this.config.VISIBILITY_GRACE_MS : this.config.MIN_DWELL_MS;

    if (leader.state === this.baseState()) {
      this.candidate = null;
      this.current = { ...this.current, confidence: leader.confidence, reason: leader.reason, estimated: leader.estimated };
    } else if (leader.confidence >= this.config.SWITCH_CONFIDENCE) {
      if (!this.candidate || this.candidate.state !== leader.state) this.candidate = { state: leader.state, since: now };
      // The very first decision of a session doesn't need to wait out the dwell.
      const first = this.current.state === "UNKNOWN" && this.current.confidence === 0;
      if (first || now - this.candidate.since >= dwellMs) {
        this.current = leader;
        this.candidate = null;
      }
    } else {
      this.candidate = null;
    }

    return (this.current = this.withSleepInference(now));
  }

  /** The state underneath any sleep inference. */
  private baseState(): ActivityState {
    return this.current.state === "POSSIBLE_SLEEP" ? "LYING_DOWN" : this.current.state;
  }

  /** Confidence-weighted vote over the window. */
  private leader(): ActivityEstimate {
    const totals = new Map<ActivityState, { weight: number; latest: ActivityEstimate }>();
    for (const f of this.frames) {
      const t = totals.get(f.estimate.state) ?? { weight: 0, latest: f.estimate };
      t.weight += f.estimate.confidence;
      t.latest = f.estimate;
      totals.set(f.estimate.state, t);
    }
    let best: { state: ActivityState; weight: number; latest: ActivityEstimate } | null = null;
    for (const [state, t] of totals) if (!best || t.weight > best.weight) best = { state, ...t };
    if (!best) return this.current;
    // Average confidence across the whole window, so a state seen in only a few frames stays weak.
    return { ...best.latest, state: best.state, confidence: best.weight / this.frames.length };
  }

  private movement(f: BodyFeatures): number | null {
    if (!f.anchor || f.shoulderWidth === null || f.shoulderWidth <= 0) {
      this.lastAnchor = null;
      return null;
    }
    const prev = this.lastAnchor;
    this.lastAnchor = { ...f.anchor, sw: f.shoulderWidth };
    if (!prev) return null;
    return Math.hypot(f.anchor.x - prev.x, f.anchor.y - prev.y) / f.shoulderWidth;
  }

  private withSleepInference(now: number): ActivityEstimate {
    if (this.baseState() !== "LYING_DOWN") {
      this.lyingSince = null;
      this.eyesClosedSince = null;
      return this.current.state === "POSSIBLE_SLEEP" ? { ...this.current, state: "LYING_DOWN" } : this.current;
    }
    if (this.lyingSince === null) this.lyingSince = now;

    const latestEyes = this.frames[this.frames.length - 1]?.eyesClosed ?? null;
    if (latestEyes !== null && latestEyes >= this.config.SLEEP_EYES_CLOSED_SCORE) {
      if (this.eyesClosedSince === null) this.eyesClosedSince = now;
    } else {
      // Eyes open, or no face visible: no eye evidence, so no sleep inference.
      this.eyesClosedSince = null;
    }

    const moves = this.frames.map((f) => f.movement).filter((m): m is number => m !== null);
    const still = moves.length >= 3 && moves.reduce((a, b) => a + b, 0) / moves.length < this.config.STILL_MOVEMENT_SW;
    const longLying = now - this.lyingSince >= this.config.SLEEP_MIN_LYING_MS;
    const eyesLong = this.eyesClosedSince !== null && now - this.eyesClosedSince >= this.config.SLEEP_EYES_CLOSED_MS;

    if (longLying && still && eyesLong) {
      return { state: "POSSIBLE_SLEEP", confidence: 0.6, estimated: true, reason: "Lying still with eyes closed for a while" };
    }
    return { ...this.current, state: "LYING_DOWN" };
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
