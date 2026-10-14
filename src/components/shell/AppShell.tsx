"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { FriendRequestNotifier } from "@/components/connect/FriendRequestNotifier";
import { CelebrationOverlay } from "@/components/connect/CelebrationOverlay";
import { PostureMonitorProvider } from "@/components/camera/PostureMonitorProvider";
import { PostureNudgeToast } from "@/components/camera/PostureNudgeToast";
import { WinterArcPopup } from "@/components/winterArc/WinterArcPopup";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PostureMonitorProvider>
    <div className="flex min-h-dvh bg-background text-foreground">
      <Sidebar />
      {/* min-w-0: without it this flex item can't shrink below its widest descendant, which widened every page on phones. */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <Header />
        <main className="pb-safe min-w-0 flex-1 px-4 pt-5 md:px-8 md:pt-8">{children}</main>
      </div>
      <FriendRequestNotifier />
      <CelebrationOverlay />
      <PostureNudgeToast />
      <WinterArcPopup />
    </div>
    </PostureMonitorProvider>
  );
}
