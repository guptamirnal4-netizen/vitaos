"use client";

import { SubNav } from "@/components/shell/SubNav";

const TABS = [
  { label: "Overview", href: "/connect" },
  { label: "Find a Friend", href: "/connect/find" },
  { label: "Friends", href: "/connect/friends" },
  { label: "Messages", href: "/connect/messages" },
  { label: "Milestones", href: "/connect/milestones" },
  { label: "Discover", href: "/connect/discover" },
  { label: "Trainers", href: "/connect/trainers" },
];
// "My Profile" lives in the global nav (sidebar / drawer), so it isn't repeated here.

export function ConnectSubNav() {
  return <SubNav tabs={TABS} label="Connect sections" />;
}
