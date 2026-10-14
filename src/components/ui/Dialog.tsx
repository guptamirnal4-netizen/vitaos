"use client";

import { useEffect, useEffectEvent, useId, useRef } from "react";
import clsx from "clsx";

/**
 * Accessible modal: labelled dialog role, focus moves in and is trapped,
 * Esc / backdrop click closes, focus returns to the trigger, page scroll locks.
 * On phones it sits as a bottom sheet so actions stay within thumb reach.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = ref.current;
    const firstField = dialog?.querySelector<HTMLElement>("[data-autofocus], input, textarea, select");
    (firstField ?? dialog)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        "a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)"
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={clsx(
          "pb-safe relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-overlay outline-none sm:max-w-sm sm:rounded-3xl sm:p-6",
          className
        )}
      >
        <h2 id={titleId} className="pr-10 text-lg font-semibold text-foreground">
          {title}
        </h2>
        {description && (
          <div id={descriptionId} className="mt-1 text-sm text-muted">
            {description}
          </div>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
        >
          ✕
        </button>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
