import { POSE } from "@/lib/posture/features";
import type { FaceSignals, Landmark } from "@/lib/posture/types";

/**
 * Deterministic synthetic poses (33 MediaPipe landmarks, normalized coords).
 * Tests use aspect = 1 so the geometry below is easy to reason about.
 */
type P = [number, number];

interface PoseSpec {
  nose?: P;
  ears?: [P, P];
  shoulders?: [P, P];
  hips?: [P, P];
  knees?: [P, P];
  wrists?: [P, P];
  /** Visibility for every landmark set above. */
  visibility?: number;
}

export function pose(spec: PoseSpec): Landmark[] {
  const hidden: Landmark = { x: 0, y: 0, visibility: 0 };
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ ...hidden }));
  const v = spec.visibility ?? 0.95;
  const put = (i: number, p?: P) => {
    if (p) lms[i] = { x: p[0], y: p[1], visibility: v };
  };
  put(POSE.NOSE, spec.nose);
  put(POSE.LEFT_EAR, spec.ears?.[0]);
  put(POSE.RIGHT_EAR, spec.ears?.[1]);
  put(POSE.LEFT_SHOULDER, spec.shoulders?.[0]);
  put(POSE.RIGHT_SHOULDER, spec.shoulders?.[1]);
  put(POSE.LEFT_HIP, spec.hips?.[0]);
  put(POSE.RIGHT_HIP, spec.hips?.[1]);
  put(POSE.LEFT_KNEE, spec.knees?.[0]);
  put(POSE.RIGHT_KNEE, spec.knees?.[1]);
  put(POSE.LEFT_WRIST, spec.wrists?.[0]);
  put(POSE.RIGHT_WRIST, spec.wrists?.[1]);
  return lms;
}

export const face = (pitchDeg = 5, extra: Partial<FaceSignals> = {}): FaceSignals => ({
  pitchDeg,
  rollDeg: 2,
  yawDeg: 3,
  eyesClosed: 0.05,
  ...extra,
});

/** Upper body close to a webcam, hips out of frame: what sitting at a laptop looks like. Neck height 0.675 sw. */
export const webcamUpright = (opts: { earY?: number; leftShoulderY?: number; wrists?: [P, P] } = {}) =>
  pose({
    nose: [0.5, 0.36],
    ears: [
      [0.42, opts.earY ?? 0.33],
      [0.58, opts.earY ?? 0.33],
    ],
    shoulders: [
      [0.3, opts.leftShoulderY ?? 0.6],
      [0.7, 0.6],
    ],
    wrists: opts.wrists,
  });

/** Whole body seen from a distance, sitting on a chair (thighs horizontal). */
export const fullBodySitting = () =>
  pose({
    nose: [0.5, 0.2],
    ears: [
      [0.48, 0.19],
      [0.52, 0.19],
    ],
    shoulders: [
      [0.45, 0.3],
      [0.55, 0.3],
    ],
    hips: [
      [0.46, 0.55],
      [0.54, 0.55],
    ],
    knees: [
      [0.3, 0.57],
      [0.38, 0.57],
    ],
  });

/** Whole body standing upright. */
export const fullBodyStanding = () =>
  pose({
    nose: [0.5, 0.12],
    ears: [
      [0.48, 0.11],
      [0.52, 0.11],
    ],
    shoulders: [
      [0.45, 0.22],
      [0.55, 0.22],
    ],
    hips: [
      [0.46, 0.5],
      [0.54, 0.5],
    ],
    knees: [
      [0.46, 0.72],
      [0.54, 0.72],
    ],
  });

/** Lying on a sofa, body horizontal across the frame. `headDrop` bends the neck relative to the torso. */
export const lyingDown = (headDrop = 0) =>
  pose({
    nose: [0.15, 0.55 + headDrop],
    ears: [
      [0.17, 0.5 + headDrop],
      [0.17, 0.6 + headDrop],
    ],
    shoulders: [
      [0.3, 0.5],
      [0.3, 0.6],
    ],
    hips: [
      [0.6, 0.5],
      [0.6, 0.6],
    ],
  });
