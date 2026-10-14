"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { PageHeader } from "@/components/shell/PageHeader";
import { AreaPicker, AreaPoint } from "@/components/connect/AreaPicker";
import { Button } from "@/components/ui/Button";
import { SPORTS, sportMeta } from "@/lib/connect/sports";
import { useCurrentUser } from "@/lib/auth/authStore";

const RADIUS_OPTIONS = [1, 2, 5, 10, 25];
const STEPS = ["Area", "When", "Activity"] as const;
const NETWORK_ERROR = "Couldn't reach Find a Friend. Check your connection and try again.";

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function defaultScheduleTime(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return toLocalInput(d);
}

function scheduleLabel(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Pick a time"
    : d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function FindAFriend() {
  const user = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [area, setArea] = useState<AreaPoint | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const [scheduledFor, setScheduledFor] = useState(defaultScheduleTime);
  const [sport, setSport] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<{ intentId: string; sport: string; mode: string } | null>(null);

  // Earliest allowed time, fixed when the page opens; the server re-validates on submit.
  const [minSchedule] = useState(() => toLocalInput(new Date()));
  const scheduledValid = mode === "now" || (!!scheduledFor && scheduledFor > minSchedule);
  const stepDone = [!!area, scheduledValid, !!sport];

  // The step lives in the URL so the browser Back button walks back through the steps.
  // A reload keeps the step but not the answers, so never show a step whose earlier answers are missing.
  const requested = Math.min(STEPS.length - 1, Math.max(0, Number(searchParams.get("step") ?? 0) || 0));
  const firstIncomplete = stepDone.findIndex((done) => !done);
  const step = firstIncomplete === -1 ? requested : Math.min(requested, firstIncomplete);

  function stepHref(n: number) {
    return n === 0 ? "/connect/find" : `/connect/find?step=${n}`;
  }

  function goTo(next: number) {
    setError(null);
    router.push(stepHref(next), { scroll: false });
  }

  // Keep the URL in step with what's shown (e.g. after a reload), so Back always returns to the previous step.
  useEffect(() => {
    if (step !== requested) router.replace(stepHref(step), { scroll: false });
  }, [step, requested, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function checkActive() {
      try {
        const res = await fetch(`/api/find/intent?email=${encodeURIComponent(user!.email)}`);
        const data = await res.json();
        if (!cancelled && data.ok) setActive(data.active);
      } catch {
        // No resume banner if the network is unreachable.
      }
    }
    checkActive();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const canContinue = stepDone[step];

  async function start() {
    if (!user || !area || !sport || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/find/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          sport,
          lat: area.lat,
          lng: area.lng,
          areaLabel: area.label,
          radiusKm,
          mode,
          startTime: mode === "scheduled" ? new Date(scheduledFor).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        // Replace, so Back from the radar returns to Connect rather than a half-finished form.
        router.replace(`/connect/find/${data.intentId}`);
        return;
      }
      setError(data.error ?? "Couldn't start the search. Please try again.");
    } catch {
      setError(NETWORK_ERROR);
    }
    setStarting(false);
  }

  const summary = [
    area && `${area.label} · ${radiusKm} km`,
    step > 1 || stepDone[1] ? (mode === "now" ? "Now" : scheduleLabel(scheduledFor)) : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <PageHeader icon="🔎" title="Find a Friend" subtitle="Find real people nearby who want to do the same activity — now or later." />

      {active && (
        <Link
          href={`/connect/find/${active.intentId}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm text-foreground hover:bg-accent/15"
        >
          <span className="min-w-0">
            <span aria-hidden="true">{sportMeta(active.sport).icon}</span> You have a live {sportMeta(active.sport).label} search
          </span>
          <span className="shrink-0 font-semibold text-accent-foreground">Resume radar →</span>
        </Link>
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-muted" aria-live="polite">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
        <ol className="grid grid-cols-3 gap-1.5" aria-label="Progress">
          {STEPS.map((label, i) => {
            const reachable = i < step;
            const content = (
              <>
                <span
                  className={clsx(
                    "block h-1.5 rounded-full",
                    i <= step ? "bg-accent" : "bg-surface-2"
                  )}
                />
                <span className={clsx("mt-1.5 block truncate text-xs", i === step ? "font-semibold text-foreground" : "text-muted")}>
                  {i < step ? "✓ " : ""}
                  {label}
                </span>
              </>
            );
            return (
              <li key={label} aria-current={i === step ? "step" : undefined}>
                {reachable ? (
                  <button type="button" onClick={() => goTo(i)} className="w-full text-left" aria-label={`Back to ${label}`}>
                    {content}
                  </button>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {summary.length > 0 && step > 0 && (
        <p className="break-anywhere rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">{summary.join(" · ")}</p>
      )}

      {step === 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="find-step-title">
          <h2 id="find-step-title" className="text-base font-semibold text-foreground">
            Where do you want to meet?
          </h2>
          <AreaPicker value={area} radiusKm={radiusKm} onChange={setArea} />
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted">Search radius</legend>
            <div role="radiogroup" aria-label="Search radius" className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={radiusKm === r}
                  onClick={() => setRadiusKm(r)}
                  className={clsx(
                    "min-h-9 min-w-14 rounded-full border px-3 text-xs font-medium transition-colors",
                    radiusKm === r
                      ? "border-accent bg-accent text-accent-contrast"
                      : "border-border-strong bg-surface text-foreground hover:bg-surface-2"
                  )}
                >
                  {r} km
                </button>
              ))}
            </div>
          </fieldset>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-3" aria-labelledby="find-step-title">
          <h2 id="find-step-title" className="text-base font-semibold text-foreground">
            When?
          </h2>
          <div role="radiogroup" aria-label="When" className="grid gap-3 sm:grid-cols-2">
            {(["now", "scheduled"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={clsx(
                  "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                  mode === m ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-border bg-surface hover:bg-surface-2"
                )}
              >
                <span className="text-xl" aria-hidden="true">
                  {m === "now" ? "⚡" : "📅"}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{m === "now" ? "Now" : "Schedule for later"}</span>
                  <span className="block text-xs text-muted">
                    {m === "now" ? "Match with people who are free right now" : "Pick a date and time"}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {mode === "scheduled" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="find-when" className="text-xs font-medium text-muted">
                Date and time
              </label>
              <input
                id="find-when"
                type="datetime-local"
                value={scheduledFor}
                min={minSchedule}
                onChange={(e) => setScheduledFor(e.target.value)}
                aria-invalid={!scheduledValid}
                aria-describedby={!scheduledValid ? "find-when-error" : undefined}
                className="min-h-11 w-full min-w-0 rounded-xl border border-border-strong bg-surface px-3 text-sm text-foreground outline-none focus:border-accent"
              />
              {!scheduledValid && (
                <p id="find-when-error" className="text-xs text-danger">
                  Choose a time in the future.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-3" aria-labelledby="find-step-title">
          <h2 id="find-step-title" className="text-base font-semibold text-foreground">
            What do you want to do?
          </h2>
          <div role="radiogroup" aria-label="Activity" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SPORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={sport === s.key}
                onClick={() => setSport(s.key)}
                className={clsx(
                  "flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-sm font-medium text-foreground transition-colors",
                  sport === s.key ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-border bg-surface hover:bg-surface-2"
                )}
              >
                <span className="text-2xl" aria-hidden="true">
                  {s.icon}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {!canContinue && step === 0 && (
          <p className="text-xs text-muted">Pick an area on the map, search for a place, or use your location to continue.</p>
        )}
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="secondary" onClick={() => router.back()} disabled={starting}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button className="flex-1" onClick={() => goTo(step + 1)} disabled={!canContinue}>
              Continue
            </Button>
          ) : (
            <Button className="flex-1" onClick={start} disabled={!canContinue} loading={starting}>
              {starting ? "Starting search…" : "Start searching"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FindAFriendPage() {
  return (
    <Suspense fallback={null}>
      <FindAFriend />
    </Suspense>
  );
}
