"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCurrentUser } from "@/lib/auth/authStore";
import { sportMeta } from "@/lib/connect/sports";
import { timeSlotLabel } from "@/lib/connect/timeSlot";
import { logActivityAndCelebrate } from "@/lib/connect/logActivity";

interface GroupChatResponse {
  ok: boolean;
  error?: string;
  group: { id: string; name: string; sport: string; mode: "now" | "scheduled"; startTime: string; members: string[] };
  messages: { id: string; senderName: string; body: string; createdAt: string; mine: boolean }[];
}

const POLL_MS = 3_000;

async function fetchGroupChat(groupId: string, email: string): Promise<GroupChatResponse> {
  const res = await fetch(`/api/groups/${groupId}/messages?email=${encodeURIComponent(email)}`);
  return res.json();
}

export default function GroupChatPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const { groupId } = useParams<{ groupId: string }>();

  const [chat, setChat] = useState<GroupChatResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    async function tick() {
      try {
        const data = await fetchGroupChat(groupId, user!.email);
        if (data.ok) {
          setChat(data);
          setError(null);
        } else {
          setError(data.error ?? "Couldn't load this group.");
        }
      } catch {
        setError("Couldn't reach the friend network. Check your connection and try again.");
      }
    }
    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, [user, groupId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat?.messages.length]);

  async function send() {
    if (!user || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, body: text }),
      });
      const data = await res.json();
      if (data.ok) {
        const refreshed = await fetchGroupChat(groupId, user.email);
        if (refreshed.ok) setChat(refreshed);
      } else {
        setDraft(text); // keep what they typed so they can retry
        setError(data.error ?? "Message failed to send.");
      }
    } catch {
      setDraft(text);
      setError("Message not sent — check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  async function logSession() {
    if (!user || !chat || logBusy) return;
    setLogBusy(true);
    const result = await logActivityAndCelebrate(user, { sport: chat.group.sport, groupId, recordWellnessEvent: true });
    setLogBusy(false);
    setNotice(
      result.ok
        ? { tone: "success", text: "Group session logged — it counts toward your milestones and wellness score." }
        : { tone: "error", text: result.error ?? "Couldn't log the session. Please try again." }
    );
  }

  const group = chat?.group;
  const meta = group ? sportMeta(group.sport) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-start gap-2">
        <button
          onClick={() => router.push("/connect/messages")}
          aria-label="Back to messages"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
        >
          ←
        </button>
        <div className="min-w-0 pt-1.5">
          <h1 className="break-anywhere text-lg font-semibold text-foreground">
            <span aria-hidden="true">{meta?.icon ?? "👥"}</span> {group?.name ?? "Group"}
          </h1>
          {group && meta && (
            <p className="text-xs text-muted">
              {meta.label} · {timeSlotLabel(group.mode, group.startTime)} · {group.members.length}{" "}
              {group.members.length === 1 ? "member" : "members"}
            </p>
          )}
        </div>
      </div>

      {group && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="break-anywhere text-xs text-muted">Members: {group.members.join(", ")}</p>
          <Button size="sm" variant="secondary" className="self-start sm:self-auto" onClick={logSession} loading={logBusy}>
            {logBusy ? "Logging…" : "✅ We did it — log this session"}
          </Button>
        </div>
      )}
      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={notice.tone === "error" ? "text-xs text-danger" : "text-xs text-success"}>
          {notice.text}
        </p>
      )}

      <div
        ref={listRef}
        aria-label="Messages"
        className="flex min-h-64 flex-col gap-2 overflow-y-auto rounded-2xl border border-border bg-surface p-4 max-h-[min(60dvh,36rem)]"
      >
        {chat === null ? (
          <p className="text-sm text-muted" role="status">
            {error ? "Couldn't load messages." : "Loading messages…"}
          </p>
        ) : chat.messages.length === 0 ? (
          <p className="m-auto text-center text-sm text-muted">You&apos;re in the group — say hi 👋</p>
        ) : (
          chat.messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
              {!m.mine && <span className="mb-0.5 text-[11px] text-muted">{m.senderName}</span>}
              <div
                className={`break-anywhere max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm sm:max-w-[75%] ${
                  m.mine ? "bg-accent text-accent-contrast" : "bg-surface-2 text-foreground"
                }`}
              >
                {m.body}
              </div>
            </div>
          ))
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border md:px-3"
      >
        <label htmlFor="group-draft" className="sr-only">
          Message the group
        </label>
        <input
          id="group-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the group…"
          enterKeyHint="send"
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-border-strong bg-surface px-4 text-sm text-foreground outline-none focus:border-accent"
        />
        <Button type="submit" disabled={!draft.trim() || !chat} loading={sending}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
