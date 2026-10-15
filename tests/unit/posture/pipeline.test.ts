import { describe, expect, it } from "vitest";
import { PosturePipeline } from "@/lib/posture/pipeline";
import { RULE_SETS } from "@/lib/posture/config";
import { face, lyingDown, webcamUpright } from "./fixtures";
import type { FaceSignals, Landmark } from "@/lib/posture/types";

const settings = { enabled: true, sensitivity: "medium" as const, cooldownMs: 60_000 };
const STEP = 400;

function run(p: PosturePipeline, pose: Landmark[], f: FaceSignals, ms: number, start = 0, selection: "AUTO" | "LAPTOP" | "PHONE" = "LAPTOP") {
  const out = [];
  for (let t = start; t < start + ms; t += STEP) {
    out.push(p.process({ now: t, pose, face: f, aspect: 1 }, { selection, touchFirstDevice: false }, settings));
  }
  return out;
}

describe("PosturePipeline (classify first, evaluate second)", () => {
  it("good laptop posture: sitting, laptop rules, no alerts", () => {
    const p = new PosturePipeline();
    const out = run(p, webcamUpright(), face(8), 20_000);
    const last = out[out.length - 1];
    expect(last.activity.state).toBe("SITTING");
    expect(last.evaluation.ruleSet).toBe("LAPTOP_SEATED");
    expect(last.evaluation.status).toBe("GOOD");
    expect(out.flatMap((o) => o.events)).toEqual([]);
  });

  it("persistent forward head at a laptop produces one contextual warning", () => {
    const p = new PosturePipeline();
    const out = run(p, webcamUpright({ earY: 0.46 }), face(8), RULE_SETS.LAPTOP_SEATED.persistMs + 2_000);
    const warnings = out.flatMap((o) => o.events).filter((e) => e.type === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].issue?.code).toBe("FORWARD_HEAD");
  });

  it("the same head angle is fine on a phone but flagged on a laptop", () => {
    const laptop = run(new PosturePipeline(), webcamUpright(), face(28), 15_000, 0, "LAPTOP");
    const phone = run(new PosturePipeline(), webcamUpright(), face(28), 15_000, 0, "PHONE");
    expect(laptop.at(-1)!.evaluation.status).toBe("ADJUST");
    expect(phone.at(-1)!.evaluation.status).toBe("GOOD");
  });

  it("lying down is evaluated with lying rules only", () => {
    const out = run(new PosturePipeline(), lyingDown(), face(70, { rollDeg: 85 }), 10_000);
    expect(out.at(-1)!.activity.state).toBe("LYING_DOWN");
    expect(out.at(-1)!.evaluation.status).toBe("GOOD");
  });

  it("dozing in a chair with the head tipped sideways ends in one contextual nudge", () => {
    const p = new PosturePipeline();
    // Eyes closed + 34° head tilt, sustained (dozing detection ~30 s, then the 20 s resting rule).
    const out = run(p, webcamUpright(), face(8, { rollDeg: 34, eyesClosed: 0.9 }), 70_000);
    const warnings = out.flatMap((o) => o.events).filter((e) => e.type === "warning");
    expect(out.at(-1)!.activity.state).toBe("POSSIBLE_SLEEP");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings.at(-1)!.ruleSet).toBe("RESTING");
    expect(warnings.at(-1)!.issue?.message).toMatch(/dozing/i);
  });

  it("calibration captures a baseline from good seated frames", () => {
    const p = new PosturePipeline();
    p.startCalibration();
    const out = run(p, webcamUpright(), face(18), 5_000);
    const done = out.find((o) => o.calibrated)?.calibrated;
    expect(done?.neckHeightRatio).toBeCloseTo(0.675, 2);
    expect(done?.pitchDeg).toBeCloseTo(18, 5);
    expect(p.calibrating).toBe(false);
    // With the baseline, 18° of pitch is this user's upright posture.
    expect(run(p, webcamUpright(), face(30), 2_000, 6_000).at(-1)!.evaluation.issues.map((i) => i.code)).not.toContain("HEAD_DOWN");
  });
});
