"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export interface SubNavTab {
  label: string;
  href: string;
}

/**
 * Section tabs for a module (Connect, Move, Sanctuary). Tabs wrap onto a
 * second line on narrow screens instead of scrolling sideways, so every
 * destination is visible without hidden horizontal swiping.
 * The first tab is the module root and only matches its exact path.
 */
export function SubNav({ tabs, label }: { tabs: SubNavTab[]; label: string }) {
  const pathname = usePathname();
  const rootHref = tabs[0]?.href;

  return (
    <nav aria-label={label} className="mb-6 border-b border-border pb-3">
      <ul className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const active = tab.href === rootHref ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-9 items-center rounded-full px-3 text-[13px] font-medium transition-colors sm:px-3.5",
                  active
                    ? "bg-accent text-accent-contrast"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
