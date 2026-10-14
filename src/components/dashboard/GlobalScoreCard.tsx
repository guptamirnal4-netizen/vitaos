"use client";

import { useWellnessStore } from "@/lib/store/wellnessStore";
import { ScoreKey } from "@/lib/types";
import { ProgressBar } from "@/components/ui/ProgressBar";

const SCORE_META: { key: ScoreKey; label: string }[] = [
  { key: "posture", label: "Posture" },
  { key: "focus", label: "Focus" },
  { key: "movement", label: "Movement" },
  { key: "circadian", label: "Circadian" },
  { key: "recovery", label: "Recovery" },
];

export function GlobalScoreCard() {
  const globalScore = useWellnessStore((s) => s.globalScore);
  const scores = useWellnessStore((s) => s.scores);
  const eventCount = useWellnessStore((s) => s.events.length);

  return (
    <section aria-labelledby="global-score-title" className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col items-center gap-2 border-b border-border pb-5 text-center">
        <h1 id="global-score-title" className="text-xs font-semibold uppercase tracking-widest text-muted">
          Global Wellness Score
        </h1>
        <span className="text-5xl font-semibold tabular-nums sm:text-6xl">
          {globalScore}
          <span className="text-xl text-muted sm:text-2xl"> / 100</span>
        </span>
        <p className="max-w-md text-sm text-muted">
          A weighted blend of the five areas below. Every action you log in any module moves the area it affects.
          {eventCount === 0 && " You're at the starting baseline — log an activity to see it change."}
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SCORE_META.map((m) => (
          <div key={m.key} className="rounded-xl bg-surface-2 p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>{m.label}</span>
              <span className="tabular-nums text-foreground">{scores[m.key]}</span>
            </div>
            <ProgressBar value={scores[m.key]} />
          </div>
        ))}
      </div>
    </section>
  );
}
