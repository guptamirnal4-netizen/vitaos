"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { useCameraStore } from "@/lib/store/cameraStore";
import type { CameraPermissionState } from "@/lib/store/cameraStore";
import { useWellnessStore } from "@/lib/store/wellnessStore";
import { NudgeTracker } from "./postureNudges";
import { deliverNudge } from "./nudgeDelivery";
import { faceSignalsFromMatrix } from "@/lib/posture/features";
import { PosturePipeline } from "@/lib/posture/pipeline";
import { PostureSession } from "@/lib/posture/session";
import type { SessionError } from "@/lib/posture/session";
import type { AlertEvent } from "@/lib/posture/alertValidator";

const MEDIAPIPE_VERSION = "1.0.1";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
// Lite variant: small and fast enough for a few inferences per second on laptops and phones.
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

interface Detectors {
  face: FaceLandmarker;
  pose: PoseLandmarker;
}

// Module-scoped so the models are downloaded and compiled once per tab, then reused by every session.
let detectorsPromise: Promise<Detectors> | null = null;

async function getDetectors(): Promise<Detectors> {
  if (!detectorsPromise) {
    detectorsPromise = (async () => {
      const { FaceLandmarker, PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      // GPU where available; some devices refuse it, so fall back to CPU rather than failing.
      async function withFallback<T>(create: (delegate: "GPU" | "CPU") => Promise<T>): Promise<T> {
        try {
          return await create("GPU");
        } catch {
          return create("CPU");
        }
      }
      const [face, pose] = await Promise.all([
        withFallback((delegate) =>
          FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
            outputFacialTransformationMatrixes: true,
            // Eye closure only — keeps "possible sleep" from ever being inferred from stillness alone.
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1,
            minFaceDetectionConfidence: 0.6,
            minFacePresenceConfidence: 0.6,
            minTrackingConfidence: 0.6,
          })
        ),
        withFallback((delegate) =>
          PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputSegmentationMasks: false,
          })
        ),
      ]);
      return { face, pose };
    })().catch((err) => {
      detectorsPromise = null; // allow a retry
      throw err;
    });
  }
  return detectorsPromise;
}

// Chrome/Edge's ImageCapture reads frames straight from the camera track, which keeps
// working while the tab is in the background (a hidden <video> may stop updating).
interface ImageCaptureLike {
  grabFrame(): Promise<ImageBitmap>;
}
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

const BREAK_COPY = { title: "Time for a short break", body: "You've been in one position for a while. Stand up, stretch, or walk for a minute." };

const PERMISSION_FOR_ERROR: Record<SessionError, CameraPermissionState> = {
  denied: "denied",
  unavailable: "unavailable",
  "in-use": "unavailable",
  "insecure-context": "insecure-context",
  "model-failed": "granted",
};

/** Turns alert events into nudges and the existing wellness events. */
function handleAlertEvent(event: AlertEvent) {
  const camera = useCameraStore.getState();
  const { logEvent } = useWellnessStore.getState();
  if (event.type === "warning") {
    camera.recordSessionEvent("warning", event.issue?.code);
    // Lying down or dozing isn't "slouching": those neck nudges never count against the posture score.
    const counts = event.ruleSet !== "LYING" && event.ruleSet !== "RESTING";
    if (counts) {
      camera.registerSlouchEvent();
      logEvent("slouch_detected", { duration: Math.round(event.sustainedMs / 1000) });
    }
  }
  if (event.type === "recovered") {
    camera.recordSessionEvent("recovered");
    if (event.ruleSet !== "LYING" && event.ruleSet !== "RESTING") logEvent("posture_alignment_restored");
  }
  if (!event.notify) return;
  if ((event.type === "warning" || event.type === "reminder") && event.issue) {
    camera.markAlertFired();
    deliverNudge("posture", { title: "Quick posture check", body: event.issue.message });
  }
  if (event.type === "break") deliverNudge("posture", BREAK_COPY);
}

/**
 * Runs the camera + activity-aware posture detection. Mounted once for the
 * whole dashboard (PostureMonitorProvider) so monitoring keeps going on
 * other pages and while the tab is in the background.
 *
 * Privacy: frames are analysed in the browser and discarded immediately.
 * Nothing visual is stored or uploaded — only derived events (e.g. "slouch
 * detected") reach the wellness store, exactly as before.
 */
export function usePostureCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const captureRef = useRef<ImageCaptureLike | null>(null);
  const pipelineRef = useRef<PosturePipeline | null>(null);
  const gazeRef = useRef(new NudgeTracker());
  const sessionRef = useRef<PostureSession<MediaStream> | null>(null);

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    const pipeline = pipelineRef.current;
    if (!video || !pipeline) return;

    let frame: ImageBitmap | null = null;
    try {
      if (document.hidden && captureRef.current) frame = await captureRef.current.grabFrame();
    } catch {
      frame = null; // fall back to the video element below
    }
    const source = frame ?? (video.readyState >= 2 ? video : null);
    if (!source) return;

    try {
      const { face, pose } = await getDetectors();
      const now = performance.now();
      const faceResult = face.detectForVideo(source, now);
      const poseResult = pose.detectForVideo(source, now);
      const matrix = faceResult.facialTransformationMatrixes?.[0]?.data;
      const faceSignals = matrix ? faceSignalsFromMatrix(matrix, faceResult.faceBlendshapes?.[0]?.categories) : null;
      const width = frame?.width ?? video.videoWidth;
      const height = frame?.height ?? video.videoHeight;

      // Settings are read fresh each tick so changes apply without restarting the camera.
      const camera = useCameraStore.getState();
      const settings = {
        enabled: camera.alertsEnabled,
        sensitivity: camera.alertSensitivity,
        cooldownMs: camera.alertCooldownMinutes * 60_000,
        instant: camera.instantAlerts,
      };
      if (camera.calibrating && !pipeline.calibrating) pipeline.startCalibration();

      const out = pipeline.process(
        { now, pose: poseResult.landmarks?.[0] ?? null, face: faceSignals, aspect: width && height ? width / height : 4 / 3 },
        { selection: camera.deviceSelection, touchFirstDevice: window.matchMedia?.("(pointer: coarse)").matches ?? false },
        settings
      );
      if (out.calibrated) camera.setCalibration(out.calibrated);

      camera.setLive({ activity: out.activity, device: out.device, evaluation: out.evaluation });
      // Legacy fields still used by the eye-level readout.
      const top = out.evaluation.issues[0];
      camera.updateMetrics({
        eyeLevelAngle: faceSignals ? Math.round(Math.max(0, 90 - faceSignals.pitchDeg)) : null,
        headTilt: faceSignals ? Math.round(faceSignals.rollDeg) : null,
        headTurn: faceSignals ? Math.round(faceSignals.yawDeg) : null,
        postureStatus:
          out.evaluation.status === "GOOD" ? "optimal" : out.evaluation.status === "ADJUST" ? (top?.severity === "moderate" ? "elevated-risk" : "mild") : null,
      });

      // Gaze ("looking away from the screen") only makes sense while seated at a screen.
      const atScreen = out.evaluation.ruleSet === "LAPTOP_SEATED" || out.evaluation.ruleSet === "GENERAL_SEATED";
      const gazeEvents = gazeRef.current.update(
        now,
        faceSignals && atScreen ? { postureStatus: "optimal", headTilt: 0, headTurn: faceSignals.yawDeg } : null,
        { sensitivity: settings.sensitivity, cooldownMs: settings.cooldownMs, postureEnabled: false, gazeEnabled: camera.gazeAlertsEnabled }
      );
      // Debounced: "warning" only once the issue has persisted (and until corrected), so the on-screen banner doesn't flicker.
      const postureState =
        out.alertPhase === "warning"
          ? "warning"
          : out.alertPhase === "recovering"
            ? "recovering"
            : out.evaluation.status === "NOT_EVALUATED"
              ? "no-detection"
              : "optimal";
      camera.setNudgeStates(postureState, gazeRef.current.states.gaze);
      for (const g of gazeEvents) if (g.notify && (g.type === "warning" || g.type === "reminder")) deliverNudge("gaze");

      out.events.forEach(handleAlertEvent);
    } finally {
      frame?.close();
    }
  }, [videoRef]);

  const processFrameRef = useRef(processFrame);
  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  /** Created on first use (from a click), never during render. */
  const getSession = useCallback((): PostureSession<MediaStream> => {
    if (sessionRef.current) return sessionRef.current;
    sessionRef.current = new PostureSession<MediaStream>({
      isSecureContext: () => window.isSecureContext,
      getUserMedia: navigator.mediaDevices?.getUserMedia
        ? () => navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
        : null,
      loadModels: async () => {
        await getDetectors();
      },
      attach: async (s) => {
        const Capture = (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
        const track = s.getVideoTracks()[0];
        captureRef.current = Capture && track ? new Capture(track) : null;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          await video.play();
        }
        pipelineRef.current = new PosturePipeline(useCameraStore.getState().calibration);
        gazeRef.current = new NudgeTracker();
        setStream(s);
      },
      detach: () => {
        captureRef.current = null;
        pipelineRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setStream(null);
      },
      processFrame: () => processFrameRef.current(),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (h) => window.clearTimeout(h as number),
      onChange: (state, error) => {
        const camera = useCameraStore.getState();
        camera.setSession(state, error);
        if (state === "running") camera.setPermission("granted");
        if (state === "error" && error) camera.setPermission(PERMISSION_FOR_ERROR[error]);
        camera.setMonitoring(state === "running" || state === "paused");
        if (state !== "running") {
          pipelineRef.current?.pause();
          gazeRef.current.pause();
          camera.setNudgeStates("no-detection", "no-detection");
        }
        if (state === "idle" || state === "error") {
          camera.updateMetrics({ eyeLevelAngle: null, headTilt: null, headTurn: null, postureStatus: null });
        }
      },
    });
    return sessionRef.current;
  }, [videoRef]);

  // Turn the camera off when the dashboard unmounts (e.g. logging out).
  useEffect(() => () => sessionRef.current?.dispose(), []);

  const start = useCallback(async () => {
    await getSession().start();
  }, [getSession]);
  const stop = useCallback(() => sessionRef.current?.stop(), []);
  const pause = useCallback(() => sessionRef.current?.pause(), []);
  const resume = useCallback(() => sessionRef.current?.resume(), []);
  const calibrate = useCallback(() => useCameraStore.getState().setCalibrating(true), []);

  return { start, stop, pause, resume, calibrate, stream };
}
