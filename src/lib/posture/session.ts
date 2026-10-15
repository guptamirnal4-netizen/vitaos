import { SESSION_CONFIG } from "./config";

/**
 * Camera + inference lifecycle, independent of React and the DOM so it can be
 * tested with fakes. Guarantees:
 * - one session at a time (start while starting/running is a no-op);
 * - every media track is stopped on stop(), on errors after the camera
 *   opened (e.g. the model failed to load), and on dispose();
 * - no frames are processed while paused or stopped;
 * - a failing frame never crashes monitoring; only a long run of failures
 *   surfaces as an error.
 */

export type SessionState = "idle" | "starting" | "running" | "paused" | "error";
export type SessionError = "denied" | "unavailable" | "in-use" | "insecure-context" | "model-failed";

export interface TrackLike {
  stop(): void;
}
export interface StreamLike {
  getTracks(): TrackLike[];
}

export interface SessionDeps<S extends StreamLike = StreamLike> {
  isSecureContext: () => boolean;
  /** null when the browser has no camera API at all. */
  getUserMedia: (() => Promise<S>) | null;
  /** Loads (or reuses) the detection models. */
  loadModels: () => Promise<void>;
  /** Attach the stream to whatever renders it (the hidden <video>). */
  attach: (stream: S) => Promise<void>;
  detach: () => void;
  /** Run inference on one frame. Throwing counts as a failed frame. */
  processFrame: () => Promise<void>;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  onChange: (state: SessionState, error: SessionError | null) => void;
  intervalMs?: number;
}

export class PostureSession<S extends StreamLike = StreamLike> {
  state: SessionState = "idle";
  error: SessionError | null = null;
  stream: S | null = null;
  private timer: unknown = null;
  private failures = 0;
  /** Bumped on every stop/start so late async results from an old session are ignored. */
  private generation = 0;

  constructor(private deps: SessionDeps<S>) {}

  async start(): Promise<void> {
    if (this.state === "starting" || this.state === "running" || this.state === "paused") return;
    const gen = ++this.generation;
    this.set("starting", null);

    if (!this.deps.isSecureContext()) return this.fail("insecure-context");
    if (!this.deps.getUserMedia) return this.fail("unavailable");

    let stream: S;
    try {
      stream = await this.deps.getUserMedia();
    } catch (err) {
      return this.fail(mapCameraError(err));
    }
    if (gen !== this.generation) {
      // stop() was called while the permission prompt was open.
      stopTracks(stream);
      return;
    }
    this.stream = stream;

    try {
      await this.deps.loadModels();
    } catch {
      this.releaseCamera();
      return this.fail("model-failed");
    }
    if (gen !== this.generation) return this.releaseCamera();

    try {
      await this.deps.attach(stream);
    } catch {
      this.releaseCamera();
      return this.fail("unavailable");
    }
    if (gen !== this.generation) return this.releaseCamera();

    this.failures = 0;
    this.set("running", null);
    this.schedule(0);
  }

  /** Stop processing frames but keep the camera open, so resuming is instant. */
  pause() {
    if (this.state !== "running") return;
    this.cancel();
    this.set("paused", null);
  }

  resume() {
    if (this.state !== "paused") return;
    this.set("running", null);
    this.schedule(0);
  }

  /** Turn the camera off and stop all processing. */
  stop() {
    this.generation++;
    this.cancel();
    this.releaseCamera();
    if (this.state !== "idle") this.set("idle", null);
  }

  dispose() {
    this.stop();
  }

  private async tick() {
    this.timer = null;
    if (this.state !== "running") return;
    const gen = this.generation;
    try {
      await this.deps.processFrame();
      this.failures = 0;
    } catch {
      this.failures++;
      if (this.failures >= SESSION_CONFIG.MAX_CONSECUTIVE_FAILURES) {
        this.stop();
        this.fail("model-failed");
        return;
      }
    }
    if (gen === this.generation && this.state === "running") this.schedule(this.deps.intervalMs ?? SESSION_CONFIG.INFERENCE_INTERVAL_MS);
  }

  private schedule(ms: number) {
    this.cancel();
    this.timer = this.deps.setTimer(() => void this.tick(), ms);
  }

  private cancel() {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
  }

  private releaseCamera() {
    if (this.stream) stopTracks(this.stream);
    this.stream = null;
    this.deps.detach();
  }

  private fail(error: SessionError) {
    this.set("error", error);
  }

  private set(state: SessionState, error: SessionError | null) {
    this.state = state;
    this.error = error;
    this.deps.onChange(state, error);
  }
}

function stopTracks(stream: StreamLike) {
  stream.getTracks().forEach((t) => t.stop());
}

/** getUserMedia errors → what the UI should explain. */
export function mapCameraError(err: unknown): SessionError {
  const name = typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "in-use";
  return "unavailable";
}
