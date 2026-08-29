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
      aria-label="Budget, Invest, Freedom"
      className="portal-tabbar fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-3">
        {SIGNED_IN_PRIMARY_NAV.map((item) => {
          const active = isPrimaryActive(pathname, item.category);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-full min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors duration-200",
                  active && "text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <NavCategoryIcon
                  category={item.category}
                  className={cn(active && "text-primary")}
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
