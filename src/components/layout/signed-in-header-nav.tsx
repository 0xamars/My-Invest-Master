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
      aria-label="Budget, Invest, Freedom"
      className="hidden min-w-0 flex-1 items-center justify-center gap-1 sm:flex"
    >
      {SIGNED_IN_PRIMARY_NAV.map((item) => {
        const active = isPrimaryActive(pathname, item.category);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-muted text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
