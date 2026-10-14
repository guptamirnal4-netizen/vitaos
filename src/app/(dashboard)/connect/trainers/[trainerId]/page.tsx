"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { getTrainer } from "@/lib/move/trainers";
import { useConnectStore } from "@/lib/store/connectStore";

export default function TrainerProfilePage() {
  const params = useParams<{ trainerId: string }>();
  const router = useRouter();
  const trainer = getTrainer(params.trainerId);
  const requestTrainerSession = useConnectStore((s) => s.requestTrainerSession);
  const trainerRequests = useConnectStore((s) => s.trainerRequests);

  const [showRequest, setShowRequest] = useState(false);
  const [date, setDate] = useState("Saturday");
  const [time, setTime] = useState("19:00");
  const [format, setFormat] = useState<"online" | "in-person">("online");
  const [goal, setGoal] = useState("Strength training");

  if (!trainer) {
    return <div className="text-sm text-muted">This trainer profile isn&apos;t available.</div>;
  }

  const existingRequest = trainerRequests.find((r) => r.trainerId === trainer.id);

  function sendRequest() {
    requestTrainerSession(trainer!.id, { date, time, format, goal });
    setShowRequest(false);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeader icon="🧑‍🏫" title={trainer.name} subtitle={trainer.title} />

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-2 text-5xl">
          {trainer.avatar}
        </span>
        <Badge>DEMO TRAINER</Badge>
        <div className="flex flex-wrap justify-center gap-2">
          {trainer.specialties.map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
        </div>
        <div className="text-sm text-foreground">⭐ {trainer.rating} · {trainer.experienceYears}+ years experience</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-xs text-muted">Training format</div>
          <div className="mt-1 text-sm capitalize text-foreground">
            {trainer.format === "both" ? "Online + In-person" : trainer.format}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-xs text-muted">Availability</div>
          <div className="mt-1 text-sm text-foreground">{trainer.availability}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-xs text-muted">Languages</div>
          <div className="mt-1 text-sm text-foreground">{trainer.languages.join(", ")}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-xs text-muted">Demo pricing</div>
          <div className="mt-1 text-sm text-foreground">${trainer.pricePerSession} / session</div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">About</div>
        <p className="text-sm text-foreground">{trainer.bio}</p>
      </div>

      {existingRequest ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-2 text-sm font-medium text-foreground">
            Session {existingRequest.status === "requested" ? "requested" : existingRequest.status}
          </div>
          <div className="text-xs text-muted">
            {existingRequest.date} · {existingRequest.time} · {existingRequest.format}
          </div>
          {existingRequest.status !== "requested" && (
            <button
              onClick={() => router.push(`/connect/trainers/session/${existingRequest.id}`)}
              className="mt-3 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast hover:opacity-90"
            >
              Message
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowRequest(true)}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast hover:opacity-90"
          >
            Request Session
          </button>
        </div>
      )}

      {showRequest && (
        <Dialog title="Session request" onClose={() => setShowRequest(false)} description={`With ${trainer.name}`}>
          <div className="grid gap-3 text-sm">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              Date
              <select value={date} onChange={(e) => setDate(e.target.value)} className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-foreground">
                {["Today", "Tomorrow", "Saturday", "Sunday"].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              Time
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-foreground" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              Format
              <select value={format} onChange={(e) => setFormat(e.target.value as "online" | "in-person")} className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-foreground">
                <option value="online">Online</option>
                <option value="in-person">In-person</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              Goal
              <input value={goal} onChange={(e) => setGoal(e.target.value)} className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-foreground" />
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowRequest(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={sendRequest}>
              Send request
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
