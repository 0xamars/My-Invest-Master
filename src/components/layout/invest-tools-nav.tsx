"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { INVEST_CHILD_NAV, INVEST_PATH, isNavItemActive } from "@/lib/chrome/nav";
import { cn } from "@/lib/utils";

export function InvestToolsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Invest tools" className="segmented">
      <Link
        href={INVEST_PATH}
        className={cn(
          "segmented-item",
          pathname === INVEST_PATH && "text-foreground",
        )}
        data-active={pathname === INVEST_PATH ? "true" : "false"}
        aria-current={pathname === INVEST_PATH ? "page" : undefined}
      >
        Checkup
      </Link>
      {INVEST_CHILD_NAV.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("segmented-item", active && "text-foreground")}
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
