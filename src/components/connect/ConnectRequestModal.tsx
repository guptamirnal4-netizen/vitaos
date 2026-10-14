"use client";

import { useState } from "react";
import { ACTIVITY_META, PartnerProfile, SearchCriteria } from "@/lib/connect/types";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

export function ConnectRequestModal({
  partner,
  criteria,
  onSend,
  onCancel,
}: {
  partner: PartnerProfile;
  criteria: SearchCriteria;
  onSend: (message?: string) => void;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState(
    `Hey! I'm planning ${criteria.activity === "running" ? "a run" : `a ${ACTIVITY_META[criteria.activity].label.toLowerCase()} session`} — want to join?`
  );

  return (
    <Dialog title={`Connect with ${partner.name}?`} onClose={onCancel}>
      <dl className="flex flex-col gap-2 text-sm">
        <Row label="Activity" value={`${ACTIVITY_META[criteria.activity].icon} ${ACTIVITY_META[criteria.activity].label}`} />
        <Row label="Preferred time" value={capitalize(criteria.time)} />
        {criteria.distanceKm && <Row label="Distance" value={`${criteria.distanceKm[1]} km`} />}
        <Row label="Group" value={criteria.groupPreference === "group" ? `${criteria.groupSize} people` : "1:1 partner"} />
      </dl>

      <label className="mt-4 flex flex-col gap-1.5 text-xs font-medium text-muted">
        Optional message
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="rounded-xl border border-border-strong bg-surface p-2.5 text-sm text-foreground outline-none focus:border-accent"
        />
      </label>

      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={() => onSend(message)}>
          Send request
        </Button>
      </div>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
