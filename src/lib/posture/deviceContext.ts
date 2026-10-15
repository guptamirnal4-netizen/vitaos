import { DEVICE_CONFIG } from "./config";
import type { BodyFeatures, DeviceContext, DeviceContextEstimate, DeviceSelection } from "./types";

/**
 * Signals about which device the person is using. A browser can't see which
 * app is in use or what the person is holding, so:
 * - an explicit selection always wins;
 * - the camera can switch the context automatically only on strong,
 *   consistent evidence (hand up near the face with the head bent down → phone;
 *   facing the screen with hands down → laptop);
 * - running on a touch-first device is a weak prior, never proof.
 */
export interface DeviceSignals {
  selection: DeviceSelection;
  /** e.g. matchMedia("(pointer: coarse)") — the app itself runs on a phone/tablet. */
  touchFirstDevice: boolean;
}

type Vote = "PHONE" | "LAPTOP" | null;

/** Camera evidence from one frame, or null when it says nothing. */
export function frameDeviceVote(f: BodyFeatures, config = DEVICE_CONFIG): Vote {
  const pitch = f.face?.pitchDeg ?? null;
  const handUp = f.wristNearFace === true || f.wristInFrontOfChest === true;
  if (handUp && pitch !== null && pitch >= config.PHONE_PITCH_DEG) return "PHONE";
  if (f.wristNearFace === false && f.face && pitch !== null && pitch < config.PHONE_PITCH_DEG && f.face.yawDeg < 25) return "LAPTOP";
  return null;
}

export class DeviceContextTracker {
  private votes: Vote[] = [];
  private auto: DeviceContext = "UNKNOWN";
  private autoConfidence = 0;

  constructor(private config = DEVICE_CONFIG) {}

  reset() {
    this.votes = [];
    this.auto = "UNKNOWN";
    this.autoConfidence = 0;
  }

  update(features: BodyFeatures | null, signals: DeviceSignals): DeviceContextEstimate {
    if (signals.selection !== "AUTO") {
      // Explicit choice: keep collecting evidence (for when they switch back to Auto) but don't act on it.
      if (features) this.push(frameDeviceVote(features, this.config));
      return { context: signals.selection, source: "user", confidence: 1 };
    }

    if (features) this.push(frameDeviceVote(features, this.config));
    const decided = this.votes.filter((v): v is "PHONE" | "LAPTOP" => v !== null);
    if (decided.length >= this.config.MIN_EVIDENCE_FRAMES) {
      const phone = decided.filter((v) => v === "PHONE").length / decided.length;
      if (phone >= this.config.SWITCH_SHARE) {
        this.auto = "PHONE";
        this.autoConfidence = phone;
      } else if (1 - phone >= this.config.SWITCH_SHARE) {
        this.auto = "LAPTOP";
        this.autoConfidence = 1 - phone;
      }
      // Mixed evidence: keep whatever was decided before.
    }

    if (this.auto !== "UNKNOWN") return { context: this.auto, source: "camera", confidence: this.autoConfidence };
    if (signals.touchFirstDevice) return { context: "PHONE", source: "default", confidence: this.config.TOUCH_DEVICE_PRIOR };
    return { context: "UNKNOWN", source: "default", confidence: 0 };
  }

  private push(vote: Vote) {
    this.votes.push(vote);
    if (this.votes.length > this.config.WINDOW_FRAMES) this.votes.shift();
  }
}
