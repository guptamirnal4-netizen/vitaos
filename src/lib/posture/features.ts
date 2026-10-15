import { LANDMARK_CONFIG } from "./config";
import type { BodyFeatures, FaceSignals, Landmark } from "./types";

/** MediaPipe Pose landmark indices used here (33-point BlazePose topology). */
export const POSE = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
} as const;

interface Point {
  x: number;
  y: number;
}

const deg = (rad: number) => (rad * 180) / Math.PI;

/** Angle of the line a→b from vertical, 0..90° (direction doesn't matter). */
function angleFromVertical(a: Point, b: Point): number {
  return deg(Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)));
}

/** Angle between two direction vectors, 0..180°. */
function angleBetween(u: Point, v: Point): number {
  const dot = u.x * v.x + u.y * v.y;
  const mag = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  if (mag === 0) return 0;
  return deg(Math.acos(Math.max(-1, Math.min(1, dot / mag))));
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Turns one frame of pose landmarks (+ optional face signals) into geometry.
 *
 * `aspect` is frame width / height. MediaPipe normalizes x by width and y by
 * height, so x is scaled by the aspect ratio first; otherwise every angle on
 * a 4:3 frame would be skewed.
 */
export function extractFeatures(pose: Landmark[] | null, face: FaceSignals | null, aspect = 4 / 3): BodyFeatures {
  const min = LANDMARK_CONFIG.MIN_VISIBILITY;
  const visible = (i: number): Point | null => {
    const lm = pose?.[i];
    if (!lm || (lm.visibility ?? 1) < min) return null;
    return { x: lm.x * aspect, y: lm.y };
  };

  const nose = visible(POSE.NOSE);
  const lEar = visible(POSE.LEFT_EAR);
  const rEar = visible(POSE.RIGHT_EAR);
  const lSh = visible(POSE.LEFT_SHOULDER);
  const rSh = visible(POSE.RIGHT_SHOULDER);
  const lHip = visible(POSE.LEFT_HIP);
  const rHip = visible(POSE.RIGHT_HIP);
  const lKnee = visible(POSE.LEFT_KNEE);
  const rKnee = visible(POSE.RIGHT_KNEE);
  const lWrist = visible(POSE.LEFT_WRIST);
  const rWrist = visible(POSE.RIGHT_WRIST);

  const usedIdx = [POSE.NOSE, POSE.LEFT_EAR, POSE.RIGHT_EAR, POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER];
  const visScores = pose ? usedIdx.map((i) => pose[i]?.visibility ?? (pose[i] ? 1 : 0)) : [];
  const score = visScores.length ? visScores.reduce((a, b) => a + b, 0) / visScores.length : face ? 0.6 : 0;

  const earMid = lEar && rEar ? mid(lEar, rEar) : (lEar ?? rEar);
  const head = earMid ?? nose;
  const shoulders = lSh && rSh;
  const shMid = shoulders ? mid(lSh, rSh) : null;
  const sw = shoulders ? dist(lSh, rSh) : null;
  const hips = lHip && rHip;
  const hipMid = hips ? mid(lHip, rHip) : (lHip ?? rHip);

  const torsoAngleDeg = shMid && hipMid ? angleFromVertical(shMid, hipMid) : null;

  const thighs: number[] = [];
  if (lHip && lKnee) thighs.push(angleFromVertical(lHip, lKnee));
  if (rHip && rKnee) thighs.push(angleFromVertical(rHip, rKnee));
  const thighAngleDeg = thighs.length ? thighs.reduce((a, b) => a + b, 0) / thighs.length : null;

  const headAxisAngleDeg = head && shMid ? angleFromVertical(head, shMid) : null;
  const neckBendDeg =
    head && shMid && hipMid
      ? angleBetween({ x: head.x - shMid.x, y: head.y - shMid.y }, { x: shMid.x - hipMid.x, y: shMid.y - hipMid.y })
      : null;

  // Ears only: the nose sits lower than the ears, so mixing them would shift the baseline.
  const neckHeightRatio = earMid && shMid && sw && sw > 0 ? (shMid.y - earMid.y) / sw : null;
  const shoulderAsymmetry = shoulders && sw && sw > 0 ? Math.abs(lSh.y - rSh.y) / sw : null;

  const wrists = [lWrist, rWrist].filter((w): w is Point => w !== null);
  const wristNearFace =
    nose && sw ? wrists.some((w) => dist(w, nose) / sw < LANDMARK_CONFIG.WRIST_NEAR_FACE_SW) : wrists.length === 0 ? null : false;
  const wristInFrontOfChest =
    shMid && sw
      ? wrists.some((w) => w.y > shMid.y && w.y < shMid.y + 1.6 * sw && Math.abs(w.x - shMid.x) < 0.8 * sw)
      : null;

  return {
    visibility: {
      head: !!(head || face),
      shoulders: !!shoulders,
      hips: !!hips,
      knees: !!(lKnee || rKnee),
      wrists: wrists.length > 0,
      score: Math.max(0, Math.min(1, score)),
    },
    shoulderWidth: sw !== null ? sw / aspect : null,
    neckHeightRatio,
    shoulderAsymmetry,
    torsoAngleDeg,
    thighAngleDeg,
    headAxisAngleDeg,
    neckBendDeg,
    wristNearFace,
    wristInFrontOfChest,
    face,
    anchor: shMid ? { x: shMid.x / aspect, y: shMid.y } : null,
  };
}

/**
 * Head orientation from a MediaPipe FaceLandmarker facial transformation
 * matrix (4x4, column-major), plus eye closure from blendshapes when present.
 * Same maths as the original eye-level reading (lib/camera/postureAnalysis.ts).
 */
export function faceSignalsFromMatrix(
  matrix: ArrayLike<number>,
  blendshapes?: ReadonlyArray<{ categoryName: string; score: number }>
): FaceSignals {
  const m00 = matrix[0];
  const m10 = matrix[1];
  const m20 = matrix[2];
  const m21 = matrix[6];
  const m22 = matrix[10];
  const pitch = deg(Math.atan2(m21, m22));
  const roll = deg(Math.atan2(m10, m00));
  const yaw = deg(Math.atan2(-m20, Math.hypot(m21, m22)));
  let eyesClosed: number | null = null;
  if (blendshapes?.length) {
    const l = blendshapes.find((b) => b.categoryName === "eyeBlinkLeft")?.score;
    const r = blendshapes.find((b) => b.categoryName === "eyeBlinkRight")?.score;
    if (l !== undefined && r !== undefined) eyesClosed = (l + r) / 2;
  }
  // Magnitude only, exactly like the original eye-level reading: the sign convention of the
  // transform isn't relied on. At a screen, large pitch in practice means looking down.
  return { pitchDeg: Math.abs(pitch), rollDeg: Math.abs(roll), yawDeg: Math.abs(yaw), eyesClosed };
}
