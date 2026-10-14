"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCurrentUser } from "@/lib/auth/authStore";
import { SPORTS } from "@/lib/connect/sports";
import { CELEBRATION_REACTIONS, CelebrationCard } from "@/lib/connect/milestones";
import { logActivityAndCelebrate } from "@/lib/connect/logActivity";
import { CelebrationCardView } from "@/components/connect/CelebrationCardView";

interface ChatMessage {
  id: string;
  senderEmail: string;
  type: "text" | "celebration";
  body: string;
  createdAt: string;
  mine: boolean;
  expiresAt?: string | null;
  reaction?: string | null;
}

const POLL_MS = 3_000;

function parseCard(body: string): CelebrationCard | null {
  try {
    return JSON.parse(body) as CelebrationCard;
  } catch {
    return null;
  }
}

function expiresLabel(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const hours = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));
  return hours <= 1 ? "Disappears within the hour" : `Disappears in ${hours}h`;
}

async function fetchMessages(connectionId: string, email: string) {
  const res = await fetch(`/api/connections/${connectionId}/messages?email=${encodeURIComponent(email)}`);
  return res.json();
}

export default function ConnectionChatPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const { connectionId } = useParams<{ connectionId: string }>();
  const justConnected = useSearchParams().get("new") === "1";

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [logging, setLogging] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  const [friendName, setFriendName] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Name for the header, from the same friends list the Connect overview uses.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`/api/friends/list?email=${encodeURIComponent(user.email)}`)
      .then((res) => res.json())
      .then((data) => {
        const friend = data.ok ? (data.friends as { name: string; connectionId: string }[]).find((f) => f.connectionId === connectionId) : null;
        if (!cancelled && friend) setFriendName(friend.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, connectionId]);

  useEffect(() => {
    if (!user) return;
    async function tick() {
      try {
        const data = await fetchMessages(connectionId, user!.email);
        if (data.ok) {
          setMessages(data.messages);
          setError(null);
        } else {
          setError(data.error ?? "Couldn't load this conversation.");
        }
      } catch {
        setError("Couldn't reach the server. Retrying…");
      }
    }
    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, [user, connectionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    if (!user || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const text = draft.trim();
    setDraft("");
    try {
      const res = await fetch(`/api/connections/${connectionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, body: text }),
      });
      const data = await res.json();
      if (data.ok) {
        const refreshed = await fetchMessages(connectionId, user.email);
        if (refreshed.ok) setMessages(refreshed.messages);
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

  async function logSession(sport: string) {
    if (!user || logBusy) return;
    setLogBusy(true);
    const result = await logActivityAndCelebrate(user, { sport, connectionId, recordWellnessEvent: true });
    setLogBusy(false);
    if (result.ok) {
      setLogging(false);
      setNotice({ tone: "success", text: "Session logged together — it counts toward your milestones and wellness score." });
    } else {
      setNotice({ tone: "error", text: result.error ?? "Couldn't log the session. Please try again." });
    }
  }

  async function react(messageId: string, emoji: string) {
    if (!user) return;
    const res = await fetch(`/api/connections/${connectionId}/messages/${messageId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, emoji }),
    });
    const data = await res.json();
    if (data.ok) setMessages((current) => current?.map((m) => (m.id === messageId ? { ...m, reaction: emoji } : m)) ?? null);
  }

  function renderCelebration(m: ChatMessage) {
    const card = parseCard(m.body);
    if (!card) return null;
    return (
      <div className="flex flex-col gap-1.5">
        <CelebrationCardView card={card} compact />
        <div className="text-[11px] text-muted">🎉 Celebration · {expiresLabel(m.expiresAt)}</div>
        {m.mine ? (
          <div className="text-xs text-muted">{m.reaction ? `They reacted ${m.reaction}` : "No reaction yet"}</div>
        ) : (
          <div className="flex gap-1">
            {CELEBRATION_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => react(m.id, emoji)}
                aria-label={`React ${emoji}`}
                aria-pressed={m.reaction === emoji}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${m.reaction === emoji ? "bg-accent/30" : "hover:bg-surface-2"}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/connect/messages")}
          aria-label="Back to messages"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
        >
          ←
        </button>
        <h1 className="break-anywhere min-w-0 text-lg font-semibold text-foreground">💬 {friendName ?? "Conversation"}</h1>
      </div>

      {justConnected && (
        <div role="status" className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-medium text-foreground">
          🎉 You&apos;re connected — say hi 👋
        </div>
      )}

      <div className="flex flex-col gap-2">
        {logging ? (
          <fieldset className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3" disabled={logBusy}>
            <legend className="px-1 text-xs font-medium text-muted">What did you do together?</legend>
            <div className="flex flex-wrap gap-1.5">
              {SPORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => logSession(s.key)}
                  className="min-h-9 rounded-full border border-border-strong px-3 text-xs text-foreground hover:bg-surface-2 disabled:opacity-50"
                >
                  {s.icon} {s.label}
                </button>
              ))}
              <button onClick={() => setLogging(false)} className="min-h-9 px-2 text-xs text-muted hover:text-foreground">
                Cancel
              </button>
            </div>
            {logBusy && (
              <p role="status" className="text-xs text-muted">
                Logging…
              </p>
            )}
          </fieldset>
        ) : (
          <button
            onClick={() => {
              setLogging(true);
              setNotice(null);
            }}
            className="flex min-h-9 items-center self-start rounded-full border border-accent/40 px-4 text-xs font-medium text-foreground hover:bg-accent/10"
          >
            ✅ Log a session together
          </button>
        )}
        {notice && (
          <p role={notice.tone === "error" ? "alert" : "status"} className={notice.tone === "error" ? "text-xs text-danger" : "text-xs text-success"}>
            {notice.text}
          </p>
        )}
      </div>

      <div
        ref={listRef}
        aria-label="Messages"
        className="flex min-h-64 flex-col gap-2 overflow-y-auto rounded-2xl border border-border bg-surface p-4 max-h-[min(60dvh,36rem)]"
      >
        {messages === null ? (
          <p className="text-sm text-muted" role="status">
            Loading messages…
          </p>
        ) : messages.length === 0 ? (
          <p className="m-auto text-center text-sm text-muted">You&apos;re connected — say hi 👋</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
              {m.type === "celebration" ? (
                renderCelebration(m)
              ) : (
                <div
                  className={`break-anywhere max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm sm:max-w-[75%] ${
                    m.mine ? "bg-accent text-accent-contrast" : "bg-surface-2 text-foreground"
                  }`}
                >
                  {m.body}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {/* Sticky so the composer stays reachable while scrolling and above the on-screen keyboard. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border md:px-3"
      >
        <label htmlFor="chat-draft" className="sr-only">
          Message
        </label>
        <input
          id="chat-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          enterKeyHint="send"
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-border-strong bg-surface px-4 text-sm text-foreground outline-none focus:border-accent"
        />
        <Button type="submit" disabled={!draft.trim()} loading={sending}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
