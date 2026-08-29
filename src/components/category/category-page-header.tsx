import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NavCategoryIcon, type NavCategory } from "@/components/layout/nav-category-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CategoryPageHeaderProps {
  category: NavCategory;
  title: string;
  description: string;
  action?: ReactNode;
}

export function CategoryPageHeader({
  category,
  title,
  description,
  action,
}: CategoryPageHeaderProps) {
  return (
    <div className="page-header">
      <div className="flex items-start gap-4">
        <NavCategoryIcon
          category={category}
          className="mt-1 size-11 rounded-2xl border border-white/8 bg-white/[0.04] text-primary"
        />
        <div className="min-w-0 space-y-1">
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function ComingSoonPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="category-coming-soon">
      <div className="category-coming-soon-chart" aria-hidden>
        <svg viewBox="0 0 320 120" className="h-full w-full">
          <defs>
            <linearGradient id="soon-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="color-mix(in srgb, var(--brand-exhaust) 22%, transparent)" />
              <stop offset="100%" stopColor="color-mix(in srgb, var(--brand-exhaust) 2%, transparent)" />
            </linearGradient>
          </defs>
          <path
            d="M0 92 C40 88, 60 72, 90 76 S150 48, 190 58 S260 28, 320 34 L320 120 L0 120 Z"
            fill="url(#soon-fill)"
          />
          <path
            d="M0 92 C40 88, 60 72, 90 76 S150 48, 190 58 S260 28, 320 34"
            fill="none"
            stroke="color-mix(in srgb, var(--brand-exhaust) 55%, transparent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <span className="category-soon-badge">Coming soon</span>
      </div>
    </div>
  );
}

export function CategorySummaryLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-8 gap-1.5 px-2 text-xs font-medium", className)}
      render={<Link href={href} />}
    >
      {label}
      <ArrowRight className="size-3.5" />
    </Button>
  );
}
