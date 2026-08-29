import type { ReactNode } from "react";
import { Target, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavCategory = "home" | "budget" | "retire" | "invest";

const ICONS = {
  home: Wallet,
  budget: Wallet,
  invest: TrendingUp,
  retire: Target,
} as const;

export function NavCategoryIcon({
  category,
  className,
}: {
  category: NavCategory;
  className?: string;
}) {
  const Icon = ICONS[category];

  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center text-current",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
  );
}

export function NavCategoryLabel({
  category,
  children,
}: {
  category: NavCategory;
  children: ReactNode;
}) {
  return (
    <span className="nav-category-label">
      <NavCategoryIcon category={category} />
      <span>{children}</span>
    </span>
  );
}
