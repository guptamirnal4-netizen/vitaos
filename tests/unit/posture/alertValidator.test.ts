import { describe, expect, it } from "vitest";
import { AlertSettings, AlertValidator } from "@/lib/posture/alertValidator";
import { ALERT_CONFIG, RULE_SETS } from "@/lib/posture/config";
import type { PostureEvaluation, RuleSetKey } from "@/lib/posture/types";

const settings: AlertSettings = { enabled: true, sensitivity: "medium", cooldownMs: 60_000 };
const STEP = 400;
const PERSIST = RULE_SETS.LAPTOP_SEATED.persistMs;

function evaluation(bad: boolean, ruleSet: RuleSetKey | null = "LAPTOP_SEATED", confidence = 0.8): PostureEvaluation {
  return {
    activity: ruleSet === "LYING" ? "LYING_DOWN" : "SITTING",
    device: "LAPTOP",
    ruleSet,
    status: ruleSet === null ? "NOT_EVALUATED" : bad ? "ADJUST" : "GOOD",
    notEvaluatedReason: null,
    issues: bad ? [{ code: "FORWARD_HEAD", severity: "mild", message: "Sit back.", value: 0.3, threshold: 0.42 }] : [],
    metrics: [],
    recommendation: bad ? "Sit back." : null,
    confidence,
  };
}

/** Feed `ms` worth of frames; returns all events and the next timestamp. */
function feed(v: AlertValidator, start: number, ms: number, e: PostureEvaluation, s = settings) {
  const events = [];
  let t = start;
  for (; t < start + ms; t += STEP) events.push(...v.update(t, e, s));
  return { events, t };
}

describe("AlertValidator", () => {
  it("brief poor posture does not produce an alert", () => {
    const v = new AlertValidator();
    const { events } = feed(v, 0, PERSIST / 2, evaluation(true));
    expect(events).toEqual([]);
    expect(v.phase).toBe("building");
  });

  it("persistent poor posture produces one alert", () => {
    const v = new AlertValidator();
    const { events } = feed(v, 0, PERSIST + 1_000, evaluation(true));
    expect(events.filter((e) => e.type === "warning")).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "warning", notify: true, ruleSet: "LAPTOP_SEATED" });
    expect(v.phase).toBe("warning");
  });

  it("a single good frame at a threshold doesn't reset a building episode", () => {
    const v = new AlertValidator();
    let t = feed(v, 0, PERSIST - 2_000, evaluation(true)).t;
    v.update(t, evaluation(false), settings); // flicker
    t += STEP;
    const { events } = feed(v, t, 3_000, evaluation(true));
    expect(events.some((e) => e.type === "warning")).toBe(true);
  });

  it("recovery clears the active warning", () => {
    const v = new AlertValidator();
    let t = feed(v, 0, PERSIST + 1_000, evaluation(true)).t;
    const { events } = feed(v, t, ALERT_CONFIG.RECOVERY_MS + 1_000, evaluation(false));
    t += ALERT_CONFIG.RECOVERY_MS + 1_000;
    expect(events.map((e) => e.type)).toEqual(["recovered"]);
    expect(v.phase).toBe("idle");
    expect(v.issue).toBeNull();
  });

  it("cooldown prevents repeating the alert when the same condition briefly reappears", () => {
    const v = new AlertValidator();
    let t = feed(v, 0, PERSIST + 400, evaluation(true)).t;
    t = feed(v, t, ALERT_CONFIG.RECOVERY_MS + 800, evaluation(false)).t;
    // Reappears and persists again, but still inside the 60 s cooldown.
    const { events } = feed(v, t, PERSIST + 1_000, evaluation(true));
    const warning = events.find((e) => e.type === "warning");
    expect(warning).toBeDefined();
    expect(warning!.notify).toBe(false);
  });

  it("reminds again only after the cooldown while still uncorrected", () => {
    const v = new AlertValidator();
    const { events } = feed(v, 0, PERSIST + settings.cooldownMs + 1_000, evaluation(true));
    expect(events.filter((e) => e.notify).map((e) => e.type)).toEqual(["warning", "reminder"]);
  });

  it("an activity or device change resets warnings that no longer apply", () => {
    const v = new AlertValidator();
    const t = feed(v, 0, PERSIST + 1_000, evaluation(true)).t;
    const events = v.update(t, evaluation(false, "LYING"), settings);
    expect(events.map((e) => e.type)).toEqual(["reset"]);
    expect(v.phase).toBe("idle");
  });

  it("switching rule sets restarts the persistence timer for the new context", () => {
    const v = new AlertValidator();
    const t = feed(v, 0, PERSIST - 1_000, evaluation(true, "LAPTOP_SEATED")).t;
    // Now on the phone: the phone episode needs its own full duration.
    const { events } = feed(v, t, 2_000, evaluation(true, "PHONE"));
    expect(events.some((e) => e.type === "warning")).toBe(false);
  });

  it("insufficient confidence suppresses alerts", () => {
    const v = new AlertValidator();
    const { events } = feed(v, 0, PERSIST * 3, evaluation(true, "LAPTOP_SEATED", 0.2));
    expect(events).toEqual([]);
    expect(v.phase).toBe("suppressed");
  });

  it("a short low-confidence dropout doesn't wipe a building episode", () => {
    const v = new AlertValidator();
    let t = feed(v, 0, PERSIST - 3_000, evaluation(true)).t;
    t = feed(v, t, 800, evaluation(true, "LAPTOP_SEATED", 0.2)).t;
    const { events } = feed(v, t, 4_000, evaluation(true));
    expect(events.some((e) => e.type === "warning")).toBe(true);
  });

  it("disabled alerts still track state but never notify", () => {
    const v = new AlertValidator();
    const { events } = feed(v, 0, PERSIST + 120_000, evaluation(true), { ...settings, enabled: false });
    expect(events.some((e) => e.type === "warning")).toBe(true);
    expect(events.every((e) => !e.notify)).toBe(true);
  });

  it("high sensitivity alerts sooner than low", () => {
    const at = (sensitivity: AlertSettings["sensitivity"]) => {
      const v = new AlertValidator();
      for (let t = 0; t < PERSIST * 2; t += STEP) {
        if (v.update(t, evaluation(true), { ...settings, sensitivity }).some((e) => e.type === "warning")) return t;
      }
      return Infinity;
    };
    expect(at("high")).toBeLessThan(at("medium"));
    expect(at("medium")).toBeLessThan(at("low"));
  });

  it("suggests a movement break after a long time without changing position", () => {
    const v = new AlertValidator();
    const { events } = feed(v, 0, ALERT_CONFIG.STATIC_BREAK_MS + 2_000, evaluation(false));
    expect(events.filter((e) => e.type === "break")).toHaveLength(1);
  });
});
