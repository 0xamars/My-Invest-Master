"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavCategoryIcon } from "@/components/layout/nav-category-icon";
import {
  SIGNED_IN_PRIMARY_NAV,
  isBudgetPath,
  isInvestPath,
  isRetirePath,
} from "@/lib/chrome/nav";
import { cn } from "@/lib/utils";

function isPrimaryActive(pathname: string, category: string): boolean {
  if (category === "budget") return isBudgetPath(pathname);
  if (category === "invest") return isInvestPath(pathname);
  if (category === "retire") return isRetirePath(pathname);
  return false;
}

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-[#02030D]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:bg-[#02030D]/95 md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-3">
        {SIGNED_IN_PRIMARY_NAV.map((item) => {
          const active = isPrimaryActive(pathname, item.category);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
                aria-current={active ? "page" : undefined}
              >
                <NavCategoryIcon
                  category={item.category}
                  className={cn("size-8", active && "text-primary")}
                />
                {item.title}
                <span
                  className={cn(
                    "mt-0.5 size-1 rounded-full",
                    active ? "bg-primary" : "bg-transparent",
                  )}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
