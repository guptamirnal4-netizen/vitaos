"use client";

import { SubNav } from "@/components/shell/SubNav";

const TABS = [
  { label: "🌿 Sanctuary", href: "/sanctuary" },
  { label: "☀️ Circadian Arc", href: "/sanctuary/circadian" },
];

export function SanctuarySubNav() {
  return <SubNav tabs={TABS} label="Sanctuary sections" />;
}
