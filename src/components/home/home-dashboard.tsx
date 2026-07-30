"use client";

import { InvestSummaryPanel } from "@/components/invest/invest-home-content";
import {
  CategorySummaryLink,
  ComingSoonPanel,
} from "@/components/category/category-page-header";
import { NavCategoryIcon, type NavCategory } from "@/components/layout/nav-category-icon";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

function SummaryPlaceholderChart({ category }: { category: NavCategory }) {
  const stroke =
    category === "retire"
      ? "oklch(0.78 0.19 55 / 50%)"
      : "oklch(0.67 0.19 152 / 45%)";

  return (
    <div className="category-summary-chart" aria-hidden>
      <svg viewBox="0 0 240 80" className="h-full w-full">
        <path
          d="M0 58 C30 54, 55 42, 80 46 S130 24, 160 30 S210 18, 240 22"
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M0 58 C30 54, 55 42, 80 46 S130 24, 160 30 S210 18, 240 22 V80 H0 Z"
          fill={
            category === "retire"
              ? "oklch(0.78 0.19 55 / 10%)"
              : "oklch(0.67 0.19 152 / 10%)"
          }
        />
      </svg>
    </div>
  );
}

function CategorySummaryCard({
  category,
  title,
  description,
  href,
  comingSoon = false,
  children,
}: {
  category: NavCategory;
  title: string;
  description: string;
  href: string;
  comingSoon?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article className={cn("category-summary-card", comingSoon && "opacity-95")}>
      <div className="category-summary-card-header">
        <div className="flex items-center gap-3">
          <NavCategoryIcon category={category} />
          <div>
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {comingSoon ? (
          <span className="category-soon-badge">Coming soon</span>
        ) : (
          <CategorySummaryLink href={href} label="Open" />
        )}
      </div>

      <div className="category-summary-card-body">
        {comingSoon ? <SummaryPlaceholderChart category={category} /> : children}
      </div>
    </article>
  );
}

export function HomeDashboard() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Your overview</h2>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email}. Summary across Budget, Retire, and Invest.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <CategorySummaryCard
          category="budget"
          title="Budget"
          description="Spending & cash flow"
          href="/budget"
          comingSoon
        />
        <CategorySummaryCard
          category="retire"
          title="Retire"
          description="Long-term goals"
          href="/retire"
          comingSoon
        />
        <CategorySummaryCard
          category="invest"
          title="Invest"
          description="Portfolio & options"
          href="/invest"
        >
          <InvestSummaryPanel compact />
        </CategorySummaryCard>
      </div>
    </section>
  );
}
