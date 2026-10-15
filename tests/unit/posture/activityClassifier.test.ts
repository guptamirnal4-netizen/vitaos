import { describe, expect, it } from "vitest";
import { ActivitySmoother, classifyFrame } from "@/lib/posture/activityClassifier";
import { ACTIVITY_CONFIG } from "@/lib/posture/config";
import { extractFeatures } from "@/lib/posture/features";
import { face, fullBodySitting, fullBodyStanding, lyingDown, pose, webcamUpright } from "./fixtures";
import type { Landmark } from "@/lib/posture/types";

const feat = (p: Landmark[] | null, f = face()) => extractFeatures(p, f, 1);
const STEP = 400;

/** Feed the smoother `count` identical frames, STEP ms apart. */
function run(smoother: ActivitySmoother, p: Landmark[] | null, count: number, start = 0, f = face()) {
  let state = smoother.state;
  for (let i = 0; i < count; i++) state = smoother.update(start + i * STEP, feat(p, f));
  return state;
}

describe("classifyFrame", () => {
  it("recognizes sitting when hips and knees are visible", () => {
    const e = classifyFrame(feat(fullBodySitting()));
    expect(e.state).toBe("SITTING");
    expect(e.estimated).toBe(false);
    expect(e.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("recognizes standing when the legs are visible and upright", () => {
    const e = classifyFrame(feat(fullBodyStanding()));
    expect(e.state).toBe("STANDING");
    expect(e.estimated).toBe(false);
  });

  it("recognizes lying down from a horizontal body axis", () => {
    expect(classifyFrame(feat(lyingDown())).state).toBe("LYING_DOWN");
  });

  it("treats a close upper-body webcam view as sitting, but marks it as estimated with lower confidence", () => {
    const e = classifyFrame(feat(webcamUpright()));
    expect(e.state).toBe("SITTING");
    expect(e.estimated).toBe(true);
    expect(e.confidence).toBeLessThan(0.8);
  });

  it("returns INSUFFICIENT_VISIBILITY when nothing usable is in frame", () => {
    expect(classifyFrame(feat(null, null as never)).state).toBe("INSUFFICIENT_VISIBILITY");
  });

  it("ignores low-confidence landmarks instead of measuring from them", () => {
    const blurry = pose({
      nose: [0.5, 0.36],
      shoulders: [
        [0.3, 0.6],
        [0.7, 0.6],
      ],
      visibility: 0.3,
    });
    const f = extractFeatures(blurry, null, 1);
    expect(f.visibility.shoulders).toBe(false);
    expect(f.neckHeightRatio).toBeNull();
    expect(classifyFrame(f).state).toBe("INSUFFICIENT_VISIBILITY");
  });

  it("abstains (UNKNOWN) when the hips are visible but the legs aren't, instead of guessing", () => {
    const partial = pose({
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
    });
    expect(classifyFrame(feat(partial)).state).toBe("UNKNOWN");
  });

  it("never returns POSSIBLE_SLEEP from a single frame", () => {
    const e = classifyFrame(feat(lyingDown(), face(5, { eyesClosed: 0.95 })));
    expect(e.state).toBe("LYING_DOWN");
  });
});

describe("ActivitySmoother", () => {
  it("settles on the first clear state immediately", () => {
    const s = new ActivitySmoother();
    expect(run(s, webcamUpright(), 1).state).toBe("SITTING");
  });

  it("switches sitting → standing only after the new state holds for the dwell time", () => {
    const s = new ActivitySmoother();
    run(s, fullBodySitting(), 10);
    // Two standing frames: not enough evidence yet.
    expect(run(s, fullBodyStanding(), 2, 10 * STEP).state).toBe("SITTING");
    // Keep standing well past the dwell time.
    const frames = Math.ceil((ACTIVITY_CONFIG.MIN_DWELL_MS * 2) / STEP);
    expect(run(s, fullBodyStanding(), frames, 12 * STEP).state).toBe("STANDING");
  });

  it("handles standing → lying down", () => {
    const s = new ActivitySmoother();
    run(s, fullBodyStanding(), 10);
    expect(run(s, lyingDown(), 20, 10 * STEP).state).toBe("LYING_DOWN");
  });

  it("doesn't flicker when frames alternate rapidly between two states", () => {
    const s = new ActivitySmoother();
    run(s, fullBodySitting(), 10);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const p = i % 2 === 0 ? fullBodySitting() : fullBodyStanding();
      seen.add(s.update((10 + i) * STEP, feat(p)).state);
    }
    expect([...seen]).toEqual(["SITTING"]);
  });

  it("rides out a brief dropout instead of jumping to INSUFFICIENT_VISIBILITY", () => {
    const s = new ActivitySmoother();
    run(s, webcamUpright(), 10);
    // ~1 s with nobody visible (a hand passes in front of the camera).
    expect(run(s, null, 2, 10 * STEP, null as never).state).toBe("SITTING");
  });

  it("reports INSUFFICIENT_VISIBILITY after a sustained loss of view", () => {
    const s = new ActivitySmoother();
    run(s, webcamUpright(), 10);
    expect(run(s, null, 20, 10 * STEP, null as never).state).toBe("INSUFFICIENT_VISIBILITY");
  });

  it("does not infer sleep from lying still with eyes open", () => {
    const s = new ActivitySmoother();
    const frames = Math.ceil((ACTIVITY_CONFIG.SLEEP_MIN_LYING_MS * 1.5) / STEP);
    expect(run(s, lyingDown(), frames, 0, face(5, { eyesClosed: 0.05 })).state).toBe("LYING_DOWN");
  });

  it("does not infer sleep from stillness when the face (eye evidence) isn't visible", () => {
    const s = new ActivitySmoother();
    const frames = Math.ceil((ACTIVITY_CONFIG.SLEEP_MIN_LYING_MS * 1.5) / STEP);
    expect(run(s, lyingDown(), frames, 0, null as never).state).toBe("LYING_DOWN");
  });

  it("does not infer sleep from a short rest with eyes closed", () => {
    const s = new ActivitySmoother();
    const frames = Math.ceil(60_000 / STEP);
    expect(run(s, lyingDown(), frames, 0, face(5, { eyesClosed: 0.95 })).state).toBe("LYING_DOWN");
  });

  it("infers POSSIBLE_SLEEP only after long, still lying with eyes closed", () => {
    const s = new ActivitySmoother();
    const frames = Math.ceil((ACTIVITY_CONFIG.SLEEP_MIN_LYING_MS + 30_000) / STEP);
    const e = run(s, lyingDown(), frames, 0, face(5, { eyesClosed: 0.95 }));
    expect(e.state).toBe("POSSIBLE_SLEEP");
    expect(e.restingFrom).toBe("LYING_DOWN");
    expect(e.estimated).toBe(true);
  });

  it("recognizes dozing off in a chair after the eyes stay closed for a while", () => {
    const s = new ActivitySmoother();
    run(s, webcamUpright(), 5);
    const frames = Math.ceil((ACTIVITY_CONFIG.SEATED_DOZE_EYES_MS + 2_000) / STEP);
    const e = run(s, webcamUpright(), frames, 5 * STEP, face(8, { eyesClosed: 0.9 }));
    expect(e.state).toBe("POSSIBLE_SLEEP");
    expect(e.restingFrom).toBe("SITTING");
  });

  it("doesn't call a short eyes-closed moment while sitting dozing", () => {
    const s = new ActivitySmoother();
    run(s, webcamUpright(), 5);
    expect(run(s, webcamUpright(), Math.ceil(10_000 / STEP), 5 * STEP, face(8, { eyesClosed: 0.9 })).state).toBe("SITTING");
  });

  it("blinking (eyes reopening) resets the dozing timer", () => {
    const s = new ActivitySmoother();
    run(s, webcamUpright(), 5);
    let t = 5 * STEP;
    let state = s.state;
    for (let i = 0; i < 8; i++) {
      // 20 s closed, then one open frame — never 30 s in a row.
      state = run(s, webcamUpright(), 50, t, face(8, { eyesClosed: 0.9 }));
      t += 50 * STEP;
      state = run(s, webcamUpright(), 1, t, face(8, { eyesClosed: 0.1 }));
      t += STEP;
    }
    expect(state.state).toBe("SITTING");
  });

  it("wakes from seated dozing back to sitting when the eyes open", () => {
    const s = new ActivitySmoother();
    const frames = Math.ceil((ACTIVITY_CONFIG.SEATED_DOZE_EYES_MS + 2_000) / STEP);
    run(s, webcamUpright(), frames, 0, face(8, { eyesClosed: 0.9 }));
    const e = run(s, webcamUpright(), 1, frames * STEP, face(8, { eyesClosed: 0.1 }));
    expect(e.state).toBe("SITTING");
    expect(e.restingFrom).toBeUndefined();
  });

  it("drops POSSIBLE_SLEEP as soon as the eyes open", () => {
    const s = new ActivitySmoother();
    const frames = Math.ceil((ACTIVITY_CONFIG.SLEEP_MIN_LYING_MS + 30_000) / STEP);
    run(s, lyingDown(), frames, 0, face(5, { eyesClosed: 0.95 }));
    expect(run(s, lyingDown(), 1, frames * STEP, face(5, { eyesClosed: 0.05 })).state).toBe("LYING_DOWN");
  });
});
