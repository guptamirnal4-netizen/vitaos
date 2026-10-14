"use client";

import { SubNav } from "@/components/shell/SubNav";
import { useIsClient } from "@/lib/useIsClient";
import { WINTER_ARC_COPY, WINTER_ARC_PAGE_PATH, isWinterArcActive } from "@/lib/winterArc/config";

const TABS = [
  { label: "Overview", href: "/move" },
  { label: "Goals", href: "/move/goals" },
  { label: "AI Coach", href: "/move/coach" },
  { label: "Workout", href: "/move/workout" },
  { label: "Exercises", href: "/move/exercises" },
  { label: "Progress", href: "/move/progress" },
];

export function MoveSubNav() {
  const isClient = useIsClient();
  // Seasonal tab, only while the event is live (client-only to avoid a hydration mismatch).
  const tabs =
    isClient && isWinterArcActive()
      ? [...TABS, { label: `❄️ ${WINTER_ARC_COPY.title}`, href: WINTER_ARC_PAGE_PATH }]
      : TABS;

  return <SubNav tabs={tabs} label="Move & Coach sections" />;
}
