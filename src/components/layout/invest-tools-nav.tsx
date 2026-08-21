"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { INVEST_CHILD_NAV, INVEST_PATH, isNavItemActive } from "@/lib/chrome/nav";
import { cn } from "@/lib/utils";

export function InvestToolsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Invest tools"
      className="flex flex-wrap gap-1.5 rounded-xl border border-border/70 bg-muted/20 p-1"
    >
      <Link
        href={INVEST_PATH}
        className={cn(
          "rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
          pathname === INVEST_PATH && "bg-background text-primary shadow-sm",
        )}
      >
        Checkup
      </Link>
      {INVEST_CHILD_NAV.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
              active && "bg-background text-primary shadow-sm",
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
