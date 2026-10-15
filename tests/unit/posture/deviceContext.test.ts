import { describe, expect, it } from "vitest";
import { DeviceContextTracker, DeviceSignals, frameDeviceVote } from "@/lib/posture/deviceContext";
import { DEVICE_CONFIG } from "@/lib/posture/config";
import { extractFeatures } from "@/lib/posture/features";
import { face, webcamUpright } from "./fixtures";

const laptopFrame = () => extractFeatures(webcamUpright({ wrists: [[0.25, 0.95], [0.75, 0.95]] }), face(8), 1);
// Wrist raised in front of the chest with the head bent down: holding a phone.
const phoneFrame = () => extractFeatures(webcamUpright({ wrists: [[0.48, 0.75], [0.75, 0.95]] }), face(38), 1);
const auto: DeviceSignals = { selection: "AUTO", touchFirstDevice: false };

function feed(t: DeviceContextTracker, make: () => ReturnType<typeof laptopFrame>, n: number, signals: DeviceSignals = auto) {
  let out = t.update(null, signals);
  for (let i = 0; i < n; i++) out = t.update(make(), signals);
  return out;
}

describe("frameDeviceVote", () => {
  it("reads a hand up with the head bent down as phone evidence", () => {
    expect(frameDeviceVote(phoneFrame())).toBe("PHONE");
  });
  it("reads facing the screen with hands down as laptop evidence", () => {
    expect(frameDeviceVote(laptopFrame())).toBe("LAPTOP");
  });
});

describe("DeviceContextTracker", () => {
  it("uses an explicit laptop selection regardless of camera evidence", () => {
    const t = new DeviceContextTracker();
    const out = feed(t, phoneFrame, 50, { selection: "LAPTOP", touchFirstDevice: false });
    expect(out).toEqual({ context: "LAPTOP", source: "user", confidence: 1 });
  });

  it("uses an explicit phone selection", () => {
    const t = new DeviceContextTracker();
    expect(feed(t, laptopFrame, 50, { selection: "PHONE", touchFirstDevice: false }).context).toBe("PHONE");
  });

  it("stays UNKNOWN with no evidence and no prior", () => {
    const t = new DeviceContextTracker();
    expect(t.update(null, auto)).toEqual({ context: "UNKNOWN", source: "default", confidence: 0 });
  });

  it("treats a touch-first device only as a weak prior", () => {
    const t = new DeviceContextTracker();
    const out = t.update(null, { selection: "AUTO", touchFirstDevice: true });
    expect(out.context).toBe("PHONE");
    expect(out.source).toBe("default");
    expect(out.confidence).toBeLessThan(0.5);
  });

  it("switches automatically only on strong, consistent evidence", () => {
    const t = new DeviceContextTracker();
    expect(feed(t, phoneFrame, DEVICE_CONFIG.MIN_EVIDENCE_FRAMES - 1).context).toBe("UNKNOWN");
    const out = feed(t, phoneFrame, 5);
    expect(out).toMatchObject({ context: "PHONE", source: "camera" });
  });

  it("does not switch on conflicting evidence", () => {
    const t = new DeviceContextTracker();
    let out = t.update(null, auto);
    for (let i = 0; i < 40; i++) out = t.update(i % 2 ? phoneFrame() : laptopFrame(), auto);
    expect(out.context).toBe("UNKNOWN");
  });

  it("keeps the established context when evidence turns weak or mixed", () => {
    const t = new DeviceContextTracker();
    feed(t, laptopFrame, 40);
    let out = t.update(null, auto);
    for (let i = 0; i < 20; i++) out = t.update(i % 2 ? phoneFrame() : laptopFrame(), auto);
    expect(out.context).toBe("LAPTOP");
  });

  it("follows a context change during a session once the new evidence dominates", () => {
    const t = new DeviceContextTracker();
    expect(feed(t, laptopFrame, 40).context).toBe("LAPTOP");
    expect(feed(t, phoneFrame, DEVICE_CONFIG.WINDOW_FRAMES).context).toBe("PHONE");
  });

  it("switching from a manual choice back to Auto uses the evidence gathered meanwhile", () => {
    const t = new DeviceContextTracker();
    feed(t, phoneFrame, 40, { selection: "LAPTOP", touchFirstDevice: false });
    expect(feed(t, phoneFrame, 1).context).toBe("PHONE");
  });
});
