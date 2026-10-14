"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { useCurrentUser } from "@/lib/auth/authStore";
import { sportMeta } from "@/lib/connect/sports";
import { timeSlotLabel } from "@/lib/connect/timeSlot";
import { Button, buttonClass } from "@/components/ui/Button";

interface RadarPerson {
  userId: string;
  name: string;
  mode: "now" | "scheduled";
  startTime: string;
  approxDistanceKm: number;
  connection: "none" | "requested" | "incoming" | "connected";
  connectionId: string | null;
}

interface RadarGroup {
  groupId: string;
  name: string;
  mode: "now" | "scheduled";
  startTime: string;
  memberCount: number;
  approxDistanceKm: number;
  joined: boolean;
}

interface RadarData {
  intent: {
    id: string;
    sport: string;
    mode: "now" | "scheduled";
    startTime: string;
    areaLabel: string | null;
    radiusKm: number;
    hidden: boolean;
    status: string;
  };
  now: RadarPerson[];
  scheduled: RadarPerson[];
  groups: RadarGroup[];
}

const POLL_MS = 5_000;
const NETWORK_ERROR = "Couldn't reach Find a Friend. Check your connection — we'll keep retrying.";
const HEARTBEAT_MS = 30_000;

function distanceLabel(km: number): string {
  return km <= 0.5 ? "< 1 km away" : `~${km} km away`;
}

/** Stable pseudo-random angle per user, so dots don't jump around between polls. */
function angleFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) * (Math.PI / 180);
}

function RadarVisual({ people, radiusKm, icon }: { people: RadarPerson[]; radiusKm: number; icon: string }) {
  // Decorative: the same people are listed below with names, distances and actions.
  return (
    <div className="relative mx-auto aspect-square w-56 max-w-full sm:w-64" aria-hidden="true">
      <div className="absolute inset-0 rounded-full border border-accent/30 bg-accent/5" />
      <div className="absolute inset-[16%] rounded-full border border-accent/20" />
      <div className="absolute inset-[33%] rounded-full border border-accent/20" />
      <div className="radar-ping absolute inset-0 rounded-full border-2 border-accent/50" />
      <div
        className="radar-sweep absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 0deg, color-mix(in srgb, var(--accent) 35%, transparent), transparent 25%)" }}
      />
      {people.map((p) => {
        const r = 0.12 + Math.min(1, p.approxDistanceKm / Math.max(radiusKm, 1)) * 0.78;
        const a = angleFor(p.userId);
        return (
          <span
            key={p.userId}
            className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-contrast shadow"
            style={{ left: `${50 + Math.cos(a) * r * 50}%`, top: `${50 + Math.sin(a) * r * 50}%` }}
          >
            {p.name.charAt(0).toUpperCase()}
          </span>
        );
      })}
      <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-xl shadow">
        {icon}
      </span>
    </div>
  );
}

export default function RadarPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const { intentId } = useParams<{ intentId: string }>();

  const [data, setData] = useState<RadarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"individuals" | "groups">("individuals");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [groupName, setGroupName] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/find/radar?email=${encodeURIComponent(user.email)}&intentId=${intentId}`);
      const json = await res.json();
      if (json.ok) {
        setData(json);
        setError(null);
      } else {
        setError(json.error ?? "Couldn't load the radar.");
      }
    } catch {
      setError(NETWORK_ERROR);
    }
  }, [user, intentId]);

  // Live results.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/find/radar?email=${encodeURIComponent(user!.email)}&intentId=${intentId}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok) {
          setData(json);
          setError(null);
        } else {
          setError(json.error ?? "Couldn't load the radar.");
        }
      } catch {
        if (!cancelled) setError(NETWORK_ERROR);
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, intentId]);

  // Presence: if this page closes, heartbeats stop and a "Now" search drops off the radar within ~90 s.
  useEffect(() => {
    if (!user) return;
    function beat() {
      fetch("/api/find/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user!.email, intentId }),
      }).catch(() => {});
    }
    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [user, intentId]);

  async function post(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user!.email, ...body }),
    });
    return res.json();
  }

  /** Runs one action under a busy key and always reports its real outcome — never a success the server didn't confirm. */
  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; error?: string; groupId?: string }>,
    success?: string
  ) {
    if (!user || busy) return null;
    setBusy(key);
    setNotice(null);
    try {
      const json = await action();
      if (json.ok) {
        if (success) setNotice({ tone: "success", text: success });
      } else {
        setNotice({ tone: "error", text: json.error ?? "That didn't work. Please try again." });
      }
      return json;
    } catch {
      setNotice({ tone: "error", text: "Couldn't reach the server. Nothing was changed — please try again." });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function sendRequest(person: RadarPerson) {
    await run(
      person.userId,
      () => post("/api/find/request", { name: user!.name, intentId, toUserId: person.userId }),
      `Request sent to ${person.name}. You can chat once they accept.`
    );
    await load();
  }

  async function joinGroup(group: RadarGroup) {
    const json = await run(group.groupId, () => post(`/api/groups/${group.groupId}/join`, {}));
    if (json?.ok) router.push(`/connect/groups/${group.groupId}`);
  }

  async function startGroup() {
    if (!groupName.trim()) return;
    const json = await run("new-group", () => post("/api/groups", { intentId, name: groupName }));
    if (json?.ok && json.groupId) router.push(`/connect/groups/${json.groupId}`);
  }

  async function block(person: RadarPerson) {
    setMenuFor(null);
    await run(
      `block-${person.userId}`,
      () => post("/api/connections/block", { targetUserId: person.userId }),
      `${person.name} is blocked. You won't see each other again.`
    );
    await load();
  }

  async function report(person: RadarPerson) {
    const json = await run(
      `report-${person.userId}`,
      () => post("/api/connections/report", { targetUserId: person.userId, reason: reportReason }),
      `Thanks — ${person.name} was reported and blocked.`
    );
    if (json?.ok) {
      setReportFor(null);
      setReportReason("");
    }
    await load();
  }

  async function toggleHidden() {
    if (!data) return;
    const hidden = !data.intent.hidden;
    await run(
      "visibility",
      () => post("/api/find/visibility", { intentId, hidden }),
      hidden ? "You're hidden from the radar. You can still see others." : "You're visible on the radar again."
    );
    await load();
  }

  async function cancelSearch() {
    const json = await run("cancel", () => post("/api/find/cancel", { intentId }));
    if (json?.ok) router.push("/connect");
  }

  if (error && !data) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
        <span className="text-4xl" aria-hidden="true">
          📡
        </span>
        <h1 className="text-lg font-semibold text-foreground">Couldn&apos;t load this search</h1>
        <p role="alert" className="text-sm text-muted">
          {error}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={load}>Try again</Button>
          <Link href="/connect/find" className={buttonClass("secondary")}>
            Start a new search
          </Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-10" role="status">
        <div className="aspect-square w-56 animate-pulse rounded-full bg-surface-2" aria-hidden="true" />
        <p className="text-sm text-muted">Starting radar…</p>
      </div>
    );
  }

  const meta = sportMeta(data.intent.sport);
  const people = [...data.now, ...data.scheduled];

  if (data.intent.status !== "active") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
        <span className="text-4xl" aria-hidden="true">
          {meta.icon}
        </span>
        <h1 className="text-lg font-semibold text-foreground">This search has ended</h1>
        <p className="text-sm text-muted">
          {data.intent.status === "cancelled"
            ? "You cancelled it, or started a newer search."
            : data.intent.mode === "now"
              ? "It expired after you went offline."
              : "Its time slot has passed."}
        </p>
        <Link href="/connect/find" className={buttonClass("primary")}>
          Start a new search
        </Link>
      </div>
    );
  }

  function renderPerson(person: RadarPerson) {
    const menuOpen = menuFor === person.userId;
    const firstName = person.name.split(" ")[0];
    return (
      <li key={person.userId} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent-foreground"
            aria-hidden="true"
          >
            {person.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="break-anywhere text-sm font-semibold text-foreground">{person.name}</h3>
            <p className="text-xs text-muted">
              {meta.icon} {meta.label} · {timeSlotLabel(person.mode, person.startTime)} · {distanceLabel(person.approxDistanceKm)}
            </p>
          </div>
          <button
            onClick={() => setMenuFor(menuOpen ? null : person.userId)}
            aria-label={`Safety options for ${person.name}`}
            aria-expanded={menuOpen}
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-muted hover:bg-surface-2 hover:text-foreground"
          >
            ⋯
          </button>
        </div>

        {menuOpen && (
          <div className="flex flex-wrap gap-2 rounded-xl bg-surface-2 p-2">
            <Button size="sm" variant="secondary" onClick={() => block(person)} loading={busy === `block-${person.userId}`}>
              Block
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="text-danger"
              onClick={() => {
                setReportFor(person.userId);
                setMenuFor(null);
              }}
            >
              Report…
            </Button>
          </div>
        )}

        {reportFor === person.userId && (
          <div className="flex flex-col gap-2 rounded-xl border border-danger/30 p-3">
            <label htmlFor={`report-${person.userId}`} className="text-xs font-medium text-foreground">
              Report {person.name}
            </label>
            <input
              id={`report-${person.userId}`}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="What happened? (optional)"
              className="min-h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm text-foreground outline-none focus:border-accent"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="danger" onClick={() => report(person)} loading={busy === `report-${person.userId}`}>
                Report &amp; block
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setReportFor(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {person.connection === "connected" && person.connectionId ? (
          <Link href={`/connect/messages/${person.connectionId}`} className={buttonClass("secondary", "md", "w-full")}>
            💬 Connected — open chat
          </Link>
        ) : person.connection === "requested" ? (
          <p className="flex min-h-11 items-center justify-center rounded-full bg-surface-2 px-4 text-center text-sm text-muted">
            ✓ Request sent — waiting for {firstName}
          </p>
        ) : person.connection === "incoming" ? (
          <Link href="/connect/friends" className={buttonClass("primary", "md", "w-full")}>
            {firstName} sent you a request — respond
          </Link>
        ) : (
          <Button className="w-full" onClick={() => sendRequest(person)} loading={busy === person.userId} disabled={!!busy}>
            {busy === person.userId ? "Sending…" : "Send request"}
          </Button>
        )}
      </li>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 lg:max-w-4xl">
      <div className="flex items-center justify-between gap-2">
        <Link href="/connect" className="-ml-2 flex min-h-11 items-center rounded-lg px-2 text-sm text-muted hover:text-foreground">
          ← Connect
        </Link>
        <Button size="sm" variant="secondary" onClick={cancelSearch} loading={busy === "cancel"}>
          {busy === "cancel" ? "Ending…" : "End search"}
        </Button>
      </div>

      <div className="grid items-center gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
        <RadarVisual people={people} radiusKm={data.intent.radiusKm} icon={meta.icon} />

        <div className="flex flex-col gap-3 text-center md:text-left">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {people.length} {people.length === 1 ? "person" : "people"} looking for {meta.label} near you
            </h1>
            <p className="break-anywhere mt-1 text-xs text-muted">
              {data.intent.areaLabel ?? "Your area"} · {data.intent.radiusKm} km · {timeSlotLabel(data.intent.mode, data.intent.startTime)}
            </p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted md:justify-start">
              <span className={clsx("h-1.5 w-1.5 rounded-full", error ? "bg-warning" : "bg-success")} aria-hidden="true" />
              {error ? "Reconnecting…" : "Updates live every few seconds"}
            </p>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm text-foreground md:justify-start">
            <input
              type="checkbox"
              checked={data.intent.hidden}
              onChange={toggleHidden}
              disabled={busy === "visibility"}
              className="h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              Hide me from the radar <span className="text-muted">(you can still see others)</span>
            </span>
          </label>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-foreground">
          {error}
        </p>
      )}

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={clsx(
            "rounded-xl border px-4 py-3 text-sm",
            notice.tone === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-foreground"
          )}
        >
          {notice.tone === "success" ? "✓ " : ""}
          {notice.text}
        </p>
      )}

      <div role="tablist" aria-label="Results" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
        {(["individuals", "groups"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls="radar-results"
            onClick={() => setTab(t)}
            className={clsx(
              "min-h-10 rounded-full px-3 text-sm font-medium transition-colors",
              tab === t ? "bg-surface text-foreground shadow-card" : "text-muted hover:text-foreground"
            )}
          >
            {t === "individuals" ? `People (${people.length})` : `Groups (${data.groups.length})`}
          </button>
        ))}
      </div>

      <div id="radar-results" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "individuals" ? (
          <div className="flex flex-col gap-5">
            {people.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border-strong px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No one nearby yet</p>
                <p className="mt-1 text-sm text-muted">
                  Keep this screen open — new people appear here automatically. You can also start a new search with a wider radius.
                </p>
              </div>
            )}
            {data.now.length > 0 && (
              <section className="flex flex-col gap-2" aria-labelledby="radar-now">
                <h2 id="radar-now" className="text-xs font-semibold uppercase tracking-widest text-muted">
                  ⚡ Free now
                </h2>
                <ul className="grid gap-3 lg:grid-cols-2">{data.now.map(renderPerson)}</ul>
              </section>
            )}
            {data.scheduled.length > 0 && (
              <section className="flex flex-col gap-2" aria-labelledby="radar-scheduled">
                <h2 id="radar-scheduled" className="text-xs font-semibold uppercase tracking-widest text-muted">
                  📅 Scheduled
                </h2>
                <ul className="grid gap-3 lg:grid-cols-2">{data.scheduled.map(renderPerson)}</ul>
              </section>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {data.groups.map((g) => (
                <li
                  key={g.groupId}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      {meta.icon}
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-anywhere text-sm font-semibold text-foreground">{g.name}</h3>
                      <p className="text-xs text-muted">
                        {g.memberCount} {g.memberCount === 1 ? "member" : "members"} · {timeSlotLabel(g.mode, g.startTime)} ·{" "}
                        {distanceLabel(g.approxDistanceKm)}
                      </p>
                    </div>
                  </div>
                  {g.joined ? (
                    <Link href={`/connect/groups/${g.groupId}`} className={buttonClass("secondary", "md", "shrink-0")}>
                      Open chat
                    </Link>
                  ) : (
                    <Button className="shrink-0" onClick={() => joinGroup(g)} loading={busy === g.groupId} disabled={!!busy}>
                      {busy === g.groupId ? "Joining…" : "Join group"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {data.groups.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
                No groups nearby for this time yet. Start one below and people on the radar can join.
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                startGroup();
              }}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-2 p-4"
            >
              <label htmlFor="new-group-name" className="text-sm font-medium text-foreground">
                Start a group
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="new-group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={60}
                  placeholder={`e.g. "Morning ${meta.label} Crew"`}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3 text-sm text-foreground outline-none focus:border-accent"
                />
                <Button type="submit" disabled={!groupName.trim()} loading={busy === "new-group"}>
                  {busy === "new-group" ? "Starting…" : "Start group"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
