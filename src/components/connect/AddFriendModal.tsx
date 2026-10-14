"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/auth/authStore";
import { Dialog } from "@/components/ui/Dialog";
import { Button, buttonClass } from "@/components/ui/Button";

/**
 * Quick "Add Friend" entry point on the main Connect screen, using the same
 * real, cross-device friend-code system as /connect/friends
 * (src/lib/network/friendsDb.ts) — not the local demo-partner simulation.
 */
export function AddFriendModal({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const [codeInput, setCodeInput] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    if (!user || !codeInput.trim() || status === "sending") return;
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromEmail: user.email, fromName: user.name, toCode: codeInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the friend network. Check your connection and try again.");
    }
  }

  return (
    <Dialog
      title="Add Friend"
      onClose={onClose}
      description={<>Enter a friend&apos;s unique code. Works across real devices — find your own code on the Friends tab.</>}
    >
      {status === "sent" ? (
        <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="text-3xl" aria-hidden="true">
            ✅
          </span>
          <div className="text-sm font-medium text-foreground">Request sent. They&apos;ll see it next time they open togetherfit.</div>
          <Link href="/connect/friends" className={buttonClass("secondary", "sm")} onClick={onClose}>
            View Friends →
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="add-friend-code" className="mb-1.5 block text-xs font-medium text-muted">
            Friend code
          </label>
          <input
            id="add-friend-code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="e.g. SB-7K2QAF"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={status === "error"}
            aria-describedby={status === "error" ? "add-friend-error" : undefined}
            className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-4 text-sm text-foreground outline-none focus:border-accent"
          />
          {status === "error" && (
            <p id="add-friend-error" role="alert" className="mt-2 text-xs text-danger">
              {message}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button type="submit" className="flex-1" disabled={!codeInput.trim()} loading={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send request"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
