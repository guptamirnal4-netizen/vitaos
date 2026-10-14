"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export function CameraPrivacyIndicator({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={clsx(
          "flex h-9 min-w-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium transition-colors",
          active ? "bg-danger/15 text-danger" : "bg-surface-2 text-muted"
        )}
      >
        <span aria-hidden="true" className="text-sm leading-none lg:hidden">
          📷
        </span>
        <span className={clsx("h-1.5 w-1.5 rounded-full", active ? "bg-danger animate-pulse" : "bg-muted")} />
        {/* Narrow headers show just the dot so everything fits; the label stays available to screen readers. */}
        <span className="sr-only lg:not-sr-only">{active ? "CAMERA MONITORING ACTIVE" : "CAMERA OFF"}</span>
      </button>

      {open && (
        <div role="status" className="absolute right-0 top-full z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-3 text-xs text-muted shadow-overlay">
          {active ? (
            <>
              togetherfit is analyzing your camera feed locally in your browser. No video is being
              recorded or uploaded.
            </>
          ) : (
            <>Camera monitoring is off. Turn it on from the Posture &amp; Gaze Guard module.</>
          )}
        </div>
      )}
    </div>
  );
}
