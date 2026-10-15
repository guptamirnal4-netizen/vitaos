import { describe, expect, it } from "vitest";
import { evaluatePosture, selectRuleSet } from "@/lib/posture/postureEngine";
import { RULE_SETS } from "@/lib/posture/config";
import { extractFeatures } from "@/lib/posture/features";
import { face, fullBodyStanding, lyingDown, webcamUpright } from "./fixtures";
import type { ActivityEstimate, ActivityState } from "@/lib/posture/types";

const act = (state: ActivityState, confidence = 0.8): ActivityEstimate => ({ state, confidence, estimated: false, reason: "" });
const codes = (e: ReturnType<typeof evaluatePosture>) => e.issues.map((i) => i.code);

describe("selectRuleSet", () => {
  it("classifies first: activity decides, device refines", () => {
    expect(selectRuleSet("SITTING", "LAPTOP")).toBe("LAPTOP_SEATED");
    expect(selectRuleSet("SITTING", "PHONE")).toBe("PHONE");
    expect(selectRuleSet("SITTING", "UNKNOWN")).toBe("GENERAL_SEATED");
    expect(selectRuleSet("STANDING", "LAPTOP")).toBe("STANDING");
    expect(selectRuleSet("STANDING", "PHONE")).toBe("PHONE");
    expect(selectRuleSet("LYING_DOWN", "LAPTOP")).toBe("LYING");
  });

  it("uses neck-only resting rules while dozing, and no rules when unsure", () => {
    expect(selectRuleSet("POSSIBLE_SLEEP", "PHONE")).toBe("RESTING");
    expect(selectRuleSet("UNKNOWN", "LAPTOP")).toBeNull();
    expect(selectRuleSet("INSUFFICIENT_VISIBILITY", "LAPTOP")).toBeNull();
  });
});

describe("evaluatePosture — laptop", () => {
  it("accepts a comfortable upright laptop posture", () => {
    const e = evaluatePosture({ activity: act("SITTING"), device: "LAPTOP", features: extractFeatures(webcamUpright(), face(8), 1) });
    expect(e.status).toBe("GOOD");
    expect(e.issues).toEqual([]);
    expect(e.recommendation).toBeNull();
  });

  it("flags forward head (neck height collapsed) with laptop-specific advice", () => {
    const e = evaluatePosture({ activity: act("SITTING"), device: "LAPTOP", features: extractFeatures(webcamUpright({ earY: 0.46 }), face(8), 1) });
    expect(codes(e)).toContain("FORWARD_HEAD");
    expect(e.recommendation).toMatch(/sit back/i);
  });

  it("flags uneven shoulders", () => {
    const e = evaluatePosture({
      activity: act("SITTING"),
      device: "LAPTOP",
      features: extractFeatures(webcamUpright({ leftShoulderY: 0.66 }), face(8), 1),
    });
    expect(codes(e)).toContain("SHOULDER_ASYMMETRY");
  });

  it("uses the calibrated baseline when available (camera placement)", () => {
    const features = extractFeatures(webcamUpright(), face(22), 1);
    const uncalibrated = evaluatePosture({ activity: act("SITTING"), device: "LAPTOP", features });
    // This user's camera sits low, so 20° of pitch is their normal upright view.
    const calibrated = evaluatePosture({
      activity: act("SITTING"),
      device: "LAPTOP",
      features,
      calibration: { neckHeightRatio: 0.675, pitchDeg: 20, capturedAt: 0 },
    });
    expect(codes(uncalibrated)).toContain("HEAD_DOWN");
    expect(codes(calibrated)).not.toContain("HEAD_DOWN");
  });

  it("respects the threshold boundary exactly", () => {
    const limit = RULE_SETS.LAPTOP_SEATED.headDownDeg;
    const at = evaluatePosture({ activity: act("SITTING"), device: "LAPTOP", features: extractFeatures(webcamUpright(), face(limit), 1) });
    const over = evaluatePosture({ activity: act("SITTING"), device: "LAPTOP", features: extractFeatures(webcamUpright(), face(limit + 1), 1) });
    expect(codes(at)).not.toContain("HEAD_DOWN");
    expect(codes(over)).toContain("HEAD_DOWN");
  });
});

describe("evaluatePosture — laptop vs phone use different rules", () => {
  const features = extractFeatures(webcamUpright(), face(28), 1);

  it("28° of head flexion is a laptop issue…", () => {
    const e = evaluatePosture({ activity: act("SITTING"), device: "LAPTOP", features });
    expect(e.ruleSet).toBe("LAPTOP_SEATED");
    expect(codes(e)).toContain("HEAD_DOWN");
  });

  it("…but normal for a phone, which allows more flexion", () => {
    const e = evaluatePosture({ activity: act("SITTING"), device: "PHONE", features });
    expect(e.ruleSet).toBe("PHONE");
    expect(codes(e)).not.toContain("HEAD_DOWN");
  });

  it("flags sustained steep downward head inclination on a phone with phone-specific advice", () => {
    const e = evaluatePosture({ activity: act("SITTING"), device: "PHONE", features: extractFeatures(webcamUpright(), face(48), 1) });
    expect(codes(e)).toContain("HEAD_DOWN");
    expect(e.issues[0].severity).toBe("moderate");
    expect(e.recommendation).toMatch(/phone/i);
  });

  it("doesn't judge shoulders or torso lean for phone use", () => {
    const e = evaluatePosture({
      activity: act("SITTING"),
      device: "PHONE",
      features: extractFeatures(webcamUpright({ leftShoulderY: 0.66 }), face(10), 1),
    });
    expect(codes(e)).not.toContain("SHOULDER_ASYMMETRY");
    expect(e.metrics.map((m) => m.key)).not.toContain("torsoLean");
  });
});

describe("evaluatePosture — standing and lying down", () => {
  it("evaluates standing with standing rules", () => {
    const e = evaluatePosture({ activity: act("STANDING"), device: "UNKNOWN", features: extractFeatures(fullBodyStanding(), face(5), 1) });
    expect(e.ruleSet).toBe("STANDING");
    expect(e.status).toBe("GOOD");
  });

  it("does not apply seated/desk rules while lying down, even with the head bent and shoulders 'uneven'", () => {
    const e = evaluatePosture({ activity: act("LYING_DOWN"), device: "LAPTOP", features: extractFeatures(lyingDown(), face(60, { rollDeg: 80 }), 1) });
    expect(e.ruleSet).toBe("LYING");
    expect(codes(e)).not.toContain("HEAD_DOWN");
    expect(codes(e)).not.toContain("HEAD_TILT");
    expect(codes(e)).not.toContain("SHOULDER_ASYMMETRY");
    expect(e.status).toBe("GOOD");
  });

  it("only flags a sharply bent neck while lying down", () => {
    const e = evaluatePosture({ activity: act("LYING_DOWN"), device: "UNKNOWN", features: extractFeatures(lyingDown(0.15), face(5), 1) });
    expect(codes(e)).toEqual(["NECK_BENT"]);
  });

});

describe("evaluatePosture — resting / dozing", () => {
  const resting = (from: "SITTING" | "LYING_DOWN"): ActivityEstimate => ({ ...act("POSSIBLE_SLEEP", 0.6), restingFrom: from });

  it("resting with a neutral, supported head is not a fault", () => {
    const e = evaluatePosture({ activity: resting("SITTING"), device: "LAPTOP", features: extractFeatures(webcamUpright(), face(8), 1) });
    expect(e.ruleSet).toBe("RESTING");
    expect(e.status).toBe("GOOD");
  });

  it("dozing in a chair with the head tipped to one side is flagged with dozing advice", () => {
    // The real-world case: reclined, eyes closed, head tilted ~34° against a cushion.
    const e = evaluatePosture({ activity: resting("SITTING"), device: "LAPTOP", features: extractFeatures(webcamUpright(), face(8, { rollDeg: 34 }), 1) });
    expect(e.status).toBe("ADJUST");
    expect(codes(e)).toEqual(["HEAD_TILT"]);
    expect(e.recommendation).toMatch(/dozing/i);
  });

  it("dozing with the head dropped forward is flagged", () => {
    const e = evaluatePosture({ activity: resting("SITTING"), device: "UNKNOWN", features: extractFeatures(webcamUpright(), face(45), 1) });
    expect(codes(e)).toContain("HEAD_DOWN");
  });

  it("is more tolerant while dozing than while working (no nudge for a mild tilt)", () => {
    const features = extractFeatures(webcamUpright(), face(8, { rollDeg: 20 }), 1);
    expect(codes(evaluatePosture({ activity: act("SITTING"), device: "LAPTOP", features }))).toContain("HEAD_TILT");
    expect(codes(evaluatePosture({ activity: resting("SITTING"), device: "LAPTOP", features }))).toEqual([]);
  });

  it("resting lying down only checks the neck bend, not head angles to the camera", () => {
    const neutral = evaluatePosture({ activity: resting("LYING_DOWN"), device: "PHONE", features: extractFeatures(lyingDown(), face(70, { rollDeg: 85 }), 1) });
    expect(neutral.status).toBe("GOOD");
    const bent = evaluatePosture({ activity: resting("LYING_DOWN"), device: "PHONE", features: extractFeatures(lyingDown(0.15), face(5), 1) });
    expect(codes(bent)).toEqual(["NECK_BENT"]);
  });
});

describe("evaluatePosture — visibility and confidence", () => {
  it("suppresses evaluation when visibility is insufficient", () => {
    const e = evaluatePosture({ activity: act("INSUFFICIENT_VISIBILITY"), device: "LAPTOP", features: extractFeatures(null, null, 1) });
    expect(e.status).toBe("NOT_EVALUATED");
    expect(e.issues).toEqual([]);
  });

  it("suppresses evaluation when the activity itself is low-confidence", () => {
    const e = evaluatePosture({ activity: act("SITTING", 0.3), device: "LAPTOP", features: extractFeatures(webcamUpright({ earY: 0.46 }), face(40), 1) });
    expect(e.status).toBe("NOT_EVALUATED");
  });

  it("reports unmeasurable metrics as null instead of inventing them", () => {
    // Face visible, but no ears/shoulders from the pose model.
    const e = evaluatePosture({ activity: act("SITTING"), device: "LAPTOP", features: extractFeatures(null, face(8), 1) });
    const neck = e.metrics.find((m) => m.key === "neckHeight");
    expect(neck?.value).toBeNull();
    expect(neck?.ok).toBeNull();
  });
});
