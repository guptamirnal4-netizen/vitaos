import type { SessionError } from "@/lib/posture/session";
import { Icon } from "@/components/ui/Icon";

const COPY: Record<SessionError, { title: string; body: string }> = {
  denied: {
    title: "Camera access was denied",
    body: "Allow the camera again from your browser's site settings (the icon left of the address), then try again.",
  },
  unavailable: { title: "No camera found", body: "We couldn't find a camera on this device. Plug one in or check it's enabled, then try again." },
  "in-use": {
    title: "Camera is busy",
    body: "Another app or tab is using the camera. Close it (for example a video call), then try again.",
  },
  "insecure-context": { title: "Secure connection needed", body: "Camera access only works over a secure (HTTPS) connection." },
  "model-failed": {
    title: "Posture detection couldn't start",
    body: "The detection model didn't load — usually a network problem. Your camera has been turned off. Check your connection and try again.",
  },
};

export function CameraUnavailablePanel({ error, onRetry }: { error: SessionError; onRetry: () => void }) {
  const copy = COPY[error];
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-2 p-6 text-center">
      <Icon name="object.camera" size={28} className="text-muted" />
      <h3 className="text-sm font-semibold text-foreground">{copy.title}</h3>
      <p className="max-w-sm text-xs text-muted">{copy.body}</p>
      <p className="text-xs text-muted">Everything else in togetherfit works without the camera.</p>
      <div className="mt-1 flex gap-2">
        <button
          onClick={onRetry}
          className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-black hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
