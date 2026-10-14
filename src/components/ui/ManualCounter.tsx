"use client";

import { ProgressBar } from "./ProgressBar";

export function ManualCounter({
  icon,
  label,
  value,
  target,
  unit,
  step = 1,
  onChange,
}: {
  icon: string;
  label: string;
  value: number;
  target: number;
  unit: string;
  step?: number;
  onChange: (value: number) => void;
}) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  const met = value >= target;

  return (
    <div
      className={
        "flex flex-col gap-2 rounded-2xl border p-4 " +
        (met ? "border-accent/40 bg-accent/10" : "border-border bg-surface")
      }
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="text-xl">{icon}</span>
        {label}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(value - step)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong text-base text-foreground hover:bg-surface-2"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-full min-w-0 max-w-16 flex-1 rounded-lg border border-border bg-surface-2 px-1 text-center text-sm tabular-nums text-foreground"
          aria-label={`${label} (${unit})`}
        />
        <button
          onClick={() => onChange(value + step)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong text-base text-foreground hover:bg-surface-2"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
      <span className="text-xs text-muted">
        {value} of {target} {unit}
      </span>

      <ProgressBar value={pct} tone={met ? "good" : "default"} />
    </div>
  );
}
