import { ActivitySmoother } from "./activityClassifier";
import { AlertEvent, AlertPhase, AlertSettings, AlertValidator } from "./alertValidator";
import { ACTIVITY_CONFIG, SESSION_CONFIG } from "./config";
import { DeviceContextTracker, DeviceSignals } from "./deviceContext";
import { extractFeatures } from "./features";
import { evaluatePosture } from "./postureEngine";
import type {
  ActivityEstimate,
  BodyFeatures,
  DeviceContextEstimate,
  FaceSignals,
  Landmark,
  PostureCalibration,
  PostureEvaluation,
} from "./types";

export interface FrameInput {
  now: number;
  pose: Landmark[] | null;
  face: FaceSignals | null;
  aspect: number;
}

export interface FrameOutput {
  features: BodyFeatures;
  activity: ActivityEstimate;
  device: DeviceContextEstimate;
  evaluation: PostureEvaluation;
  events: AlertEvent[];
  /** Set on the frame calibration finishes. */
  calibrated: PostureCalibration | null;
  /** Debounced alert state: "warning" only once an issue has persisted, and until it's corrected. */
  alertPhase: AlertPhase;
}

/**
 * Classify first, evaluate second:
 *   features → activity (smoothed) → device context → rule set → evaluation → alert validation.
 * One instance per monitoring session.
 */
export class PosturePipeline {
  private activity = new ActivitySmoother();
  private device = new DeviceContextTracker();
  private alerts = new AlertValidator();
  private lastAnchor: { x: number; y: number } | null = null;
  private calibrationFrames: BodyFeatures[] | null = null;

  calibration: PostureCalibration | null = null;

  constructor(calibration: PostureCalibration | null = null) {
    this.calibration = calibration;
  }

  /** Start capturing an upright baseline from the next good seated frames. */
  startCalibration() {
    this.calibrationFrames = [];
  }

  get calibrating(): boolean {
    return this.calibrationFrames !== null;
  }

  pause() {
    this.alerts.pause();
    this.activity.reset();
    this.lastAnchor = null;
    this.calibrationFrames = null;
  }

  process(input: FrameInput, signals: DeviceSignals, settings: AlertSettings): FrameOutput {
    const features = extractFeatures(input.pose, input.face, input.aspect);
    const activity = this.activity.update(input.now, features);
    const device = this.device.update(features, signals);
    const evaluation = evaluatePosture({ activity, device: device.context, features, calibration: this.calibration });
    const events = this.alerts.update(input.now, evaluation, settings, this.moved(features));
    return {
      features,
      activity,
      device,
      evaluation,
      events,
      calibrated: this.collectCalibration(features, activity),
      alertPhase: this.alerts.phase,
    };
  }

  private moved(f: BodyFeatures): boolean {
    if (!f.anchor || !f.shoulderWidth) return false;
    const prev = this.lastAnchor;
    this.lastAnchor = f.anchor;
    if (!prev) return false;
    // A clear shift (more than ~half a shoulder width) counts as changing position.
    return Math.hypot(f.anchor.x - prev.x, f.anchor.y - prev.y) / f.shoulderWidth > ACTIVITY_CONFIG.STILL_MOVEMENT_SW * 25;
  }

  private collectCalibration(f: BodyFeatures, activity: ActivityEstimate): PostureCalibration | null {
    if (!this.calibrationFrames) return null;
    if (activity.state !== "SITTING" && activity.state !== "STANDING") return null;
    if (f.neckHeightRatio === null || !f.face) return null;
    this.calibrationFrames.push(f);
    if (this.calibrationFrames.length < SESSION_CONFIG.CALIBRATION_FRAMES) return null;
    const frames = this.calibrationFrames;
    this.calibrationFrames = null;
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    this.calibration = {
      neckHeightRatio: avg(frames.map((x) => x.neckHeightRatio!)),
      pitchDeg: avg(frames.map((x) => x.face!.pitchDeg)),
      capturedAt: Date.now(),
    };
    return this.calibration;
  }
}
