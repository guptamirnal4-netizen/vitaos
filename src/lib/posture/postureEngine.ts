import { ALERT_CONFIG, RULE_SETS, RuleSet } from "./config";
import type {
  ActivityEstimate,
  BodyFeatures,
  DeviceContext,
  PostureCalibration,
  PostureEvaluation,
  PostureIssue,
  PostureIssueCode,
  PostureMetric,
  RuleSetKey,
} from "./types";

/**
 * Which rules apply. Body position decides first; device context then picks
 * between laptop, phone and general rules. Lying down never gets desk
 * ergonomics; resting/dozing only gets neck checks; unknown gets no rules.
 */
export function selectRuleSet(activity: ActivityEstimate["state"], device: DeviceContext): RuleSetKey | null {
  switch (activity) {
    case "SITTING":
      return device === "LAPTOP" ? "LAPTOP_SEATED" : device === "PHONE" ? "PHONE" : "GENERAL_SEATED";
    case "STANDING":
      return device === "PHONE" ? "PHONE" : "STANDING";
    case "LYING_DOWN":
      return "LYING";
    case "POSSIBLE_SLEEP":
      return "RESTING";
    default:
      return null;
  }
}

/** Correction copy per context. Supportive, short, and never a diagnosis. */
const MESSAGES: Record<PostureIssueCode, Partial<Record<RuleSetKey, string>> & { default: string }> = {
  HEAD_DOWN: {
    LAPTOP_SEATED: "Your head is leaning forward. Try bringing the screen closer to eye level.",
    PHONE: "Try raising your phone closer to eye level to reduce sustained neck bending.",
    STANDING: "Your head is tipped down. Lift your gaze and let your shoulders drop.",
    RESTING: "You seem to be dozing with your head dropped forward, which strains your neck. Rest your head back with support, or take a proper break.",
    default: "Your head is tipped down. Lift your gaze a little.",
  },
  FORWARD_HEAD: {
    LAPTOP_SEATED: "You've been leaning forward for a while. Sit back and relax your shoulders.",
    PHONE: "Your head is tilted forward. Bring your phone higher and relax your shoulders.",
    default: "You're leaning forward. Sit back and let your head rest over your shoulders.",
  },
  HEAD_TILT: {
    RESTING: "You seem to be dozing with your head tipped to one side. Support your neck, or take a proper rest break.",
    default: "Your head is tilted to one side. Bring it back to centre.",
  },
  SHOULDER_ASYMMETRY: {
    default: "Your shoulders appear uneven. Try relaxing and adjusting your sitting position.",
    STANDING: "Your shoulders appear uneven. Try spreading your weight across both feet.",
  },
  TORSO_LEAN: {
    LAPTOP_SEATED: "You're leaning to one side or slumping. Sit back against your chair.",
    STANDING: "You're leaning. Stand tall with your weight over both feet.",
    default: "You're leaning. Sit back and straighten up gently.",
  },
  NECK_BENT: {
    default: "Your neck looks sharply bent. Try a pillow that keeps your head in line with your body.",
  },
};

export function messageFor(code: PostureIssueCode, ruleSet: RuleSetKey): string {
  return MESSAGES[code][ruleSet] ?? MESSAGES[code].default;
}

export interface EvaluationInput {
  activity: ActivityEstimate;
  device: DeviceContext;
  features: BodyFeatures;
  calibration?: PostureCalibration | null;
}

/**
 * Applies the rule set for the current activity + device to one frame.
 * Rules whose landmarks aren't visible are skipped and reported as "not
 * measurable" — they never count as good or bad.
 */
export function evaluatePosture(input: EvaluationInput, rules: Record<RuleSetKey, RuleSet> = RULE_SETS): PostureEvaluation {
  const { activity, device, features: f, calibration } = input;
  const ruleSet = selectRuleSet(activity.state, device);
  const confidence = Math.min(activity.confidence, Math.max(f.visibility.score, f.face ? 0.6 : 0));
  const base = { activity: activity.state, device, ruleSet, issues: [] as PostureIssue[], metrics: [] as PostureMetric[], recommendation: null, confidence };

  if (!ruleSet) {
    const reason =
      activity.state === "INSUFFICIENT_VISIBILITY" ? "Move so your head and shoulders are in view." : "Not sure what position you're in yet.";
    return { ...base, status: "NOT_EVALUATED", notEvaluatedReason: reason };
  }
  if (confidence < ALERT_CONFIG.MIN_CONFIDENCE) {
    return { ...base, status: "NOT_EVALUATED", notEvaluatedReason: "The camera can't see you clearly enough to judge posture." };
  }

  const rule = rules[ruleSet];
  const issues: PostureIssue[] = [];
  const metrics: PostureMetric[] = [];
  // While lying down the whole body is horizontal, so head angles relative to the camera mean nothing:
  // resting in bed only checks how the neck bends relative to the torso.
  const checks = ruleSet === "RESTING" && activity.restingFrom !== "SITTING" ? (["neckBend"] as const) : rule.checks;
  const check = (key: RuleSet["checks"][number]) => (checks as ReadonlyArray<string>).includes(key);

  if (check("headDown")) {
    // Relative to the user's calibrated upright pitch, which absorbs camera placement (a laptop webcam sits below the eyes).
    const pitch = f.face ? Math.max(0, f.face.pitchDeg - (calibration?.pitchDeg ?? 0)) : null;
    const bad = pitch !== null && pitch > rule.headDownDeg;
    metrics.push({ key: "headPitch", label: "Head angle down", value: round(pitch), unit: "°", limit: rule.headDownDeg, ok: pitch === null ? null : !bad });
    if (bad) issues.push(issue("HEAD_DOWN", ruleSet, pitch, rule.headDownDeg, pitch > rule.headDownSevereDeg));
  }

  if (check("forwardHead")) {
    const ratio = f.neckHeightRatio;
    const limit = calibration ? calibration.neckHeightRatio * rule.neckHeightMinShare : rule.neckHeightMinAbsolute;
    const share = ratio === null ? null : calibration ? ratio / calibration.neckHeightRatio : ratio / (rule.neckHeightMinAbsolute / rule.neckHeightMinShare);
    const bad = ratio !== null && ratio < limit;
    metrics.push({
      key: "neckHeight",
      label: calibration ? "Neck height vs. your baseline" : "Neck height (uncalibrated)",
      value: share === null ? null : Math.round(share * 100),
      unit: "%",
      limit: Math.round(rule.neckHeightMinShare * 100),
      ok: ratio === null ? null : !bad,
    });
    if (bad) issues.push(issue("FORWARD_HEAD", ruleSet, ratio, limit, ratio < limit * 0.9));
  }

  if (check("headTilt")) {
    const tilt = f.face?.rollDeg ?? null;
    const bad = tilt !== null && tilt > rule.headTiltDeg;
    metrics.push({ key: "headTilt", label: "Head tilt", value: round(tilt), unit: "°", limit: rule.headTiltDeg, ok: tilt === null ? null : !bad });
    if (bad) issues.push(issue("HEAD_TILT", ruleSet, tilt, rule.headTiltDeg, tilt > rule.headTiltDeg * 1.5));
  }

  if (check("shoulders")) {
    const asym = f.shoulderAsymmetry;
    const bad = asym !== null && asym > rule.shoulderAsymmetry;
    metrics.push({
      key: "shoulderAsymmetry",
      label: "Shoulder height difference",
      value: asym === null ? null : Math.round(asym * 100),
      unit: "%",
      limit: Math.round(rule.shoulderAsymmetry * 100),
      ok: asym === null ? null : !bad,
    });
    if (bad) issues.push(issue("SHOULDER_ASYMMETRY", ruleSet, asym, rule.shoulderAsymmetry, asym > rule.shoulderAsymmetry * 1.6));
  }

  if (check("torsoLean") && rule.torsoLeanDeg !== null) {
    const lean = f.torsoAngleDeg;
    const bad = lean !== null && lean > rule.torsoLeanDeg;
    metrics.push({ key: "torsoLean", label: "Torso lean", value: round(lean), unit: "°", limit: rule.torsoLeanDeg, ok: lean === null ? null : !bad });
    if (bad) issues.push(issue("TORSO_LEAN", ruleSet, lean, rule.torsoLeanDeg, lean > rule.torsoLeanDeg * 1.5));
  }

  if (check("neckBend") && rule.neckBendDeg !== null) {
    const bend = f.neckBendDeg;
    const bad = bend !== null && bend > rule.neckBendDeg;
    metrics.push({ key: "neckBend", label: "Neck bend", value: round(bend), unit: "°", limit: rule.neckBendDeg, ok: bend === null ? null : !bad });
    if (bad) issues.push(issue("NECK_BENT", ruleSet, bend, rule.neckBendDeg, bend > rule.neckBendDeg * 1.4));
  }

  if (metrics.every((m) => m.value === null)) {
    return { ...base, metrics, status: "NOT_EVALUATED", notEvaluatedReason: "The landmarks needed for this position aren't visible." };
  }

  // Most important correction first: moderate before mild, then the rule's own order.
  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "moderate" ? -1 : 1));
  return {
    ...base,
    metrics,
    issues,
    status: issues.length ? "ADJUST" : "GOOD",
    notEvaluatedReason: null,
    recommendation: issues[0]?.message ?? null,
  };
}

function issue(code: PostureIssueCode, ruleSet: RuleSetKey, value: number, threshold: number, severe: boolean): PostureIssue {
  return { code, severity: severe ? "moderate" : "mild", message: messageFor(code, ruleSet), value, threshold };
}

function round(n: number | null): number | null {
  return n === null ? null : Math.round(n);
}
