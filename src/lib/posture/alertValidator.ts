import { ALERT_CONFIG, RULE_SETS, RuleSet } from "./config";
import type { PostureEvaluation, PostureIssue, RuleSetKey } from "./types";

export type Sensitivity = keyof typeof ALERT_CONFIG.SENSITIVITY_MULTIPLIER;

export interface AlertSettings {
  enabled: boolean;
  sensitivity: Sensitivity;
  /** While still not corrected, remind again after this long. Also the minimum gap between separate episodes' nudges. */
  cooldownMs: number;
  /**
   * Alert whenever posture isn't optimal: a ~3 s debounce instead of the
   * context's persistence time, and every new episode notifies (spaced by
   * INSTANT_MIN_GAP_MS rather than the reminder interval).
   */
  instant?: boolean;
}

export type AlertPhase = "idle" | "building" | "warning" | "recovering" | "suppressed";

export interface AlertEvent {
  type: "warning" | "reminder" | "recovered" | "reset" | "break";
  /** Whether to actually show a nudge (alerts on and cooldown passed). */
  notify: boolean;
  issue: PostureIssue | null;
  ruleSet: RuleSetKey | null;
  sustainedMs: number;
}

/**
 * Turns per-frame evaluations into rare, well-timed nudges.
 *
 *   idle ──issue persists for the rule's duration──▶ warning (nudge)
 *   warning ──still uncorrected──▶ reminder every cooldown
 *   warning ──within limits──▶ recovering ──for RECOVERY_MS──▶ idle ("recovered")
 *   building ──brief good frames──▶ keeps building (flicker at a threshold doesn't reset)
 *   any ──activity/device rules change──▶ idle ("reset": the old warning no longer applies)
 *   any ──not evaluated / low confidence beyond the grace period──▶ suppressed (no alerts, no credit)
 *
 * A condition that reappears after recovery starts a new episode: it must
 * persist again, and its nudge still respects the cooldown since the last one.
 */
export class AlertValidator {
  phase: AlertPhase = "idle";
  private ruleSet: RuleSetKey | null = null;
  private badSince: number | null = null;
  private goodSince: number | null = null;
  private lowSince: number | null = null;
  private lastNotifiedAt: number | null = null;
  private activeIssue: PostureIssue | null = null;
  private staticSince: number | null = null;
  private lastBreakAt: number | null = null;

  constructor(
    private rules: Record<RuleSetKey, RuleSet> = RULE_SETS,
    private config = ALERT_CONFIG
  ) {}

  get issue(): PostureIssue | null {
    return this.activeIssue;
  }

  /** Forget timers (session paused or stopped); cooldown history is kept so a restart can't spam. */
  pause() {
    this.phase = "idle";
    this.ruleSet = null;
    this.badSince = null;
    this.goodSince = null;
    this.lowSince = null;
    this.activeIssue = null;
    this.staticSince = null;
  }

  /**
   * Feed one evaluation. `moved` = the person changed position noticeably since
   * the last frame (resets the movement-break timer).
   */
  update(now: number, evaluation: PostureEvaluation, settings: AlertSettings, moved = false): AlertEvent[] {
    const events: AlertEvent[] = [];

    // Rules changed (e.g. laptop → phone, or sat down → lay down): an old warning no longer applies.
    if (evaluation.ruleSet !== this.ruleSet) {
      if (this.phase === "warning" || this.phase === "recovering") {
        events.push({ type: "reset", notify: false, issue: this.activeIssue, ruleSet: this.ruleSet, sustainedMs: 0 });
      }
      this.phase = evaluation.ruleSet ? "idle" : "suppressed";
      this.ruleSet = evaluation.ruleSet;
      this.badSince = null;
      this.goodSince = null;
      this.activeIssue = null;
      this.staticSince = null;
    }

    const judgeable = evaluation.status !== "NOT_EVALUATED" && evaluation.confidence >= this.config.MIN_CONFIDENCE && this.ruleSet !== null;
    if (!judgeable) {
      if (this.lowSince === null) this.lowSince = now;
      if (now - this.lowSince >= this.config.LOW_CONFIDENCE_GRACE_MS) {
        // Can't see well enough: drop any building episode. Not a recovery, not a warning.
        this.phase = "suppressed";
        this.badSince = null;
        this.goodSince = null;
        this.activeIssue = null;
        this.staticSince = null;
      }
      return events;
    }
    this.lowSince = null;
    if (this.phase === "suppressed") this.phase = "idle";

    const rule = this.rules[this.ruleSet!];
    const persistMs = settings.instant
      ? this.config.INSTANT_PERSIST_MS
      : rule.persistMs * (this.config.SENSITIVITY_MULTIPLIER[settings.sensitivity] ?? 1);
    const top = evaluation.issues[0] ?? null;

    if (top) {
      this.goodSince = null;
      if (this.phase === "recovering") this.phase = "warning"; // same episode continues
      if (this.phase === "warning") {
        this.activeIssue = top;
        if (settings.enabled && this.cooledDown(now, settings.cooldownMs)) {
          this.lastNotifiedAt = now;
          events.push({ type: "reminder", notify: true, issue: top, ruleSet: this.ruleSet, sustainedMs: now - (this.badSince ?? now) });
        }
      } else {
        if (this.badSince === null) this.badSince = now;
        this.phase = "building";
        const sustainedMs = now - this.badSince;
        if (sustainedMs >= persistMs) {
          this.phase = "warning";
          this.activeIssue = top;
          const gap = settings.instant ? this.config.INSTANT_MIN_GAP_MS : settings.cooldownMs;
          const notify = settings.enabled && this.cooledDown(now, gap);
          if (notify) this.lastNotifiedAt = now;
          events.push({ type: "warning", notify, issue: top, ruleSet: this.ruleSet, sustainedMs });
        }
      }
    } else if (this.phase === "building") {
      // Readings near a threshold flicker; only a sustained good stretch clears a building episode.
      if (this.goodSince === null) this.goodSince = now;
      if (now - this.goodSince >= this.config.RECOVERY_MS) {
        this.phase = "idle";
        this.badSince = null;
        this.goodSince = null;
      }
    } else if (this.phase === "warning") {
      this.phase = "recovering";
      this.goodSince = now;
    } else if (this.phase === "recovering" && this.goodSince !== null && now - this.goodSince >= this.config.RECOVERY_MS) {
      events.push({ type: "recovered", notify: false, issue: this.activeIssue, ruleSet: this.ruleSet, sustainedMs: 0 });
      this.phase = "idle";
      this.badSince = null;
      this.goodSince = null;
      this.activeIssue = null;
    }

    events.push(...this.breakCheck(now, moved, settings));
    return events;
  }

  /** Gentle movement-break suggestion after a long stretch in one position (not a posture fault). */
  private breakCheck(now: number, moved: boolean, settings: AlertSettings): AlertEvent[] {
    if (moved || this.staticSince === null) {
      this.staticSince = now;
      return [];
    }
    if (now - this.staticSince < this.config.STATIC_BREAK_MS) return [];
    if (this.lastBreakAt !== null && now - this.lastBreakAt < this.config.STATIC_BREAK_MS) return [];
    this.lastBreakAt = now;
    this.staticSince = now;
    return [{ type: "break", notify: settings.enabled, issue: null, ruleSet: this.ruleSet, sustainedMs: this.config.STATIC_BREAK_MS }];
  }

  private cooledDown(now: number, cooldownMs: number) {
    return this.lastNotifiedAt === null || now - this.lastNotifiedAt >= cooldownMs;
  }
}
