"use client";

import { useCelebrationStore } from "./celebrationStore";
import { CelebrationCard } from "./milestones";
import { useWellnessStore } from "@/lib/store/wellnessStore";
import { EventType } from "@/lib/types";

export interface LogActivityOptions {
  sport: string;
  connectionId?: string;
  groupId?: string;
  /**
   * Also record the session in the local wellness event pipeline (Activity
   * Explorer + Global Wellness Score). Off for callers that already log their
   * own event, e.g. the workout player's workout_completed.
   */
  recordWellnessEvent?: boolean;
}

/** Same sport → event mapping the demo partner chat uses; sports without their own event count as sports_completed. */
const SPORT_EVENT: Record<string, EventType> = {
  running: "run_completed",
  gym: "gym_session_completed",
  cycling: "cycling_completed",
  yoga: "yoga_completed",
  walking: "walk_completed",
  hiking: "hiking_completed",
};

function wellnessEventFor(options: LogActivityOptions): EventType {
  if (options.groupId) return "group_activity_completed";
  return SPORT_EVENT[options.sport] ?? "sports_completed";
}

/**
 * Logs a completed activity on the real backend and, if it unlocked any
 * milestones, queues their celebration screens (CelebrationOverlay).
 */
export async function logActivityAndCelebrate(
  user: { email: string; name: string },
  options: LogActivityOptions
): Promise<{ ok: boolean; error?: string; newMilestones: CelebrationCard[] }> {
  try {
    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, name: user.name, sport: options.sport, connectionId: options.connectionId, groupId: options.groupId }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error, newMilestones: [] };
    // Only after the server confirmed the session, so the score never counts a failed log.
    if (options.recordWellnessEvent) useWellnessStore.getState().logEvent(wellnessEventFor(options));
    if (data.newMilestones.length > 0) useCelebrationStore.getState().celebrate(data.newMilestones);
    return { ok: true, newMilestones: data.newMilestones };
  } catch {
    return { ok: false, error: "Couldn't reach the server.", newMilestones: [] };
  }
}
