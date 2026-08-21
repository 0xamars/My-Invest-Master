"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavCategoryIcon } from "@/components/layout/nav-category-icon";
import {
  SIGNED_IN_PRIMARY_NAV,
  isBudgetPath,
  isHomePath,
  isInvestPath,
  isRetirePath,
} from "@/lib/chrome/nav";
import { cn } from "@/lib/utils";

function isPrimaryActive(pathname: string, category: string): boolean {
  if (category === "home") return isHomePath(pathname);
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {SIGNED_IN_PRIMARY_NAV.map((item) => {
          const active = isPrimaryActive(pathname, item.category);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
                aria-current={active ? "page" : undefined}
              >
                <NavCategoryIcon
                  category={item.category}
                  className={cn(
                    "size-8",
                    active && "ring-1 ring-primary/30",
                  )}
                />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
