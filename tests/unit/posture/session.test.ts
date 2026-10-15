import { describe, expect, it, vi } from "vitest";
import { PostureSession, SessionDeps, mapCameraError } from "@/lib/posture/session";
import { SESSION_CONFIG } from "@/lib/posture/config";

function fakeCamera() {
  const tracks = [{ stop: vi.fn() }];
  return { stream: { getTracks: () => tracks }, tracks };
}

/** Deterministic timers: run() executes queued callbacks. */
function timers() {
  const queue = new Map<number, () => void>();
  let id = 0;
  return {
    setTimer: (fn: () => void) => {
      queue.set(++id, fn);
      return id;
    },
    clearTimer: (h: unknown) => queue.delete(h as number),
    pending: () => queue.size,
    async run(n = 1) {
      for (let i = 0; i < n; i++) {
        const [key, fn] = queue.entries().next().value ?? [];
        if (!fn) return;
        queue.delete(key!);
        fn();
        // Let the async tick (frame + catch + reschedule) fully settle.
        await new Promise((resolve) => setImmediate(resolve));
      }
    },
  };
}

function deps(overrides: Partial<SessionDeps> = {}) {
  const cam = fakeCamera();
  const t = timers();
  const changes: string[] = [];
  const d: SessionDeps = {
    isSecureContext: () => true,
    getUserMedia: async () => cam.stream,
    loadModels: async () => {},
    attach: async () => {},
    detach: vi.fn(),
    processFrame: vi.fn(async () => {}),
    setTimer: t.setTimer,
    clearTimer: t.clearTimer,
    onChange: (s, e) => changes.push(e ? `${s}:${e}` : s),
    ...overrides,
  };
  return { d, cam, t, changes };
}

describe("PostureSession", () => {
  it("starts when permission is granted and processes frames", async () => {
    const { d, t, changes } = deps();
    const s = new PostureSession(d);
    await s.start();
    expect(s.state).toBe("running");
    expect(changes).toEqual(["starting", "running"]);
    await t.run(3);
    expect(d.processFrame).toHaveBeenCalledTimes(3);
  });

  it("reports a denied permission and holds no camera", async () => {
    const { d } = deps({ getUserMedia: async () => Promise.reject(Object.assign(new Error("x"), { name: "NotAllowedError" })) });
    const s = new PostureSession(d);
    await s.start();
    expect(s.state).toBe("error");
    expect(s.error).toBe("denied");
    expect(s.stream).toBeNull();
  });

  it("reports an unavailable camera (no camera API)", async () => {
    const { d } = deps({ getUserMedia: null });
    const s = new PostureSession(d);
    await s.start();
    expect(s.error).toBe("unavailable");
  });

  it("reports an insecure context before asking for the camera", async () => {
    const getUserMedia = vi.fn();
    const { d } = deps({ isSecureContext: () => false, getUserMedia });
    const s = new PostureSession(d);
    await s.start();
    expect(s.error).toBe("insecure-context");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("maps camera-in-use errors", () => {
    expect(mapCameraError({ name: "NotReadableError" })).toBe("in-use");
    expect(mapCameraError({ name: "NotFoundError" })).toBe("unavailable");
    expect(mapCameraError({ name: "NotAllowedError" })).toBe("denied");
  });

  it("turns the camera off if the model fails to load", async () => {
    const { d, cam } = deps({ loadModels: async () => Promise.reject(new Error("offline")) });
    const s = new PostureSession(d);
    await s.start();
    expect(s.state).toBe("error");
    expect(s.error).toBe("model-failed");
    expect(cam.tracks[0].stop).toHaveBeenCalled();
    expect(s.stream).toBeNull();
  });

  it("stops every camera track when monitoring ends", async () => {
    const { d, cam, t } = deps();
    const s = new PostureSession(d);
    await s.start();
    s.stop();
    expect(cam.tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(s.state).toBe("idle");
    expect(t.pending()).toBe(0);
    expect(d.detach).toHaveBeenCalled();
  });

  it("dispose (component unmount) releases the camera and timers", async () => {
    const { d, cam, t } = deps();
    const s = new PostureSession(d);
    await s.start();
    s.dispose();
    expect(cam.tracks[0].stop).toHaveBeenCalled();
    expect(t.pending()).toBe(0);
  });

  it("never runs two sessions at once", async () => {
    const getUserMedia = vi.fn(async () => fakeCamera().stream);
    const { d } = deps({ getUserMedia });
    const s = new PostureSession(d);
    await Promise.all([s.start(), s.start()]);
    await s.start();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("releases the camera if stopped while the permission prompt is still open", async () => {
    const cam = fakeCamera();
    let grant: (v: typeof cam.stream) => void = () => {};
    const { d } = deps({ getUserMedia: () => new Promise((r) => (grant = r)) });
    const s = new PostureSession(d);
    const starting = s.start();
    s.stop();
    grant(cam.stream);
    await starting;
    expect(cam.tracks[0].stop).toHaveBeenCalled();
    expect(s.state).toBe("idle");
  });

  it("pauses without processing frames and resumes", async () => {
    const { d, t } = deps();
    const s = new PostureSession(d);
    await s.start();
    s.pause();
    expect(s.state).toBe("paused");
    expect(t.pending()).toBe(0);
    s.resume();
    await t.run(1);
    expect(d.processFrame).toHaveBeenCalledTimes(1);
  });

  it("survives occasional frame failures", async () => {
    let n = 0;
    const { d, t } = deps({
      processFrame: async () => {
        if (++n % 2) throw new Error("glitch");
      },
    });
    const s = new PostureSession(d);
    await s.start();
    await t.run(10);
    expect(s.state).toBe("running");
  });

  it("stops with a model error after many consecutive failures", async () => {
    const { d, t, cam } = deps({ processFrame: async () => Promise.reject(new Error("broken")) });
    const s = new PostureSession(d);
    await s.start();
    await t.run(SESSION_CONFIG.MAX_CONSECUTIVE_FAILURES);
    expect(s.state).toBe("error");
    expect(s.error).toBe("model-failed");
    expect(cam.tracks[0].stop).toHaveBeenCalled();
  });
});
