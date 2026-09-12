"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function SignedInHeaderNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Budget, Invest, Retire"
      className="flex min-w-0 flex-1 items-center justify-center"
    >
      <div className="segmented">
        {SIGNED_IN_PRIMARY_NAV.map((item) => {
          const active = isPrimaryActive(pathname, item.category);
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
      </div>
    </nav>
  );
}
