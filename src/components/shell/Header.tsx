"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useTheme } from "next-themes";
import { useWellnessStore } from "@/lib/store/wellnessStore";
import { useCameraStore } from "@/lib/store/cameraStore";
import { useMoveStore } from "@/lib/store/moveStore";
import { pickNextDemoEvent } from "@/lib/demoEngine";
import { CameraPrivacyIndicator } from "@/components/camera/CameraPrivacyIndicator";
import { useIsClient } from "@/lib/useIsClient";
import { MobileDrawer } from "./MobileDrawer";
import { TogetherfitLogo } from "@/components/brand/TogetherfitLogo";

export function Header() {
  const demoMode = useWellnessStore((s) => s.demoMode);
  const toggleDemoMode = useWellnessStore((s) => s.toggleDemoMode);
  const logEvent = useWellnessStore((s) => s.logEvent);
  const monitoring = useCameraStore((s) => s.monitoring);
  const seedDemoWorkouts = useMoveStore((s) => s.seedDemoWorkouts);
  const { resolvedTheme, setTheme } = useTheme();
  const tickIndex = useRef(0);
  const mounted = useIsClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (demoMode) seedDemoWorkouts();
  }, [demoMode, seedDemoWorkouts]);

  useEffect(() => {
    if (!demoMode) return;
    const interval = setInterval(() => {
      const type = pickNextDemoEvent(tickIndex.current);
      tickIndex.current += 1;
      logEvent(type);
    }, 4000);
    return () => clearInterval(interval);
  }, [demoMode, logEvent]);

  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/85 md:px-8">
      <div className="flex min-w-0 items-center gap-1 md:hidden">
        <button
          ref={hamburgerRef}
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls="mobile-nav-drawer"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-foreground hover:bg-surface-2"
        >
          ☰
        </button>
        <TogetherfitLogo layout="inline" size={28} />
      </div>
      {/* Desktop: the sidebar carries the brand, so the left side stays empty. */}
      <div className="hidden md:block" />

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <CameraPrivacyIndicator active={monitoring} />
        <button
          onClick={toggleDemoMode}
          aria-pressed={demoMode}
          title={demoMode ? "Demo data is being generated. Tap to stop." : "Showing your real activity. Tap to generate demo data."}
          className={clsx(
            "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
            demoMode ? "bg-highlight/20 text-foreground" : "bg-surface-2 text-muted hover:text-foreground"
          )}
        >
          <span className={clsx("h-1.5 w-1.5 rounded-full", demoMode ? "bg-highlight" : "bg-success")} aria-hidden="true" />
          {demoMode ? "Demo on" : "Live"}
          <span className="sr-only">{demoMode ? " — demo data on" : " — demo data off"}</span>
        </button>
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex h-11 w-11 items-center justify-center rounded-full text-base text-foreground hover:bg-surface-2"
          aria-label={mounted && resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          <span aria-hidden="true">{mounted ? (resolvedTheme === "dark" ? "☾" : "☀") : "◐"}</span>
        </button>
      </div>
    </header>
    <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} triggerRef={hamburgerRef} />
    </>
  );
}
