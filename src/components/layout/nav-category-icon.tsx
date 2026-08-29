import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NavCategory = "home" | "budget" | "retire" | "invest";

const iconClass = "size-3.5";
const brand = "text-[var(--brand-orange)] dark:text-[var(--brand-green)]";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
      <path
        d="M4.5 10.5 12 4.5l7.5 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={brand}
      />
      <path
        d="M6.5 9.5V18a1.5 1.5 0 0 0 1.5 1.5H10v-4.5h4V19.5h2a1.5 1.5 0 0 0 1.5-1.5V9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={brand}
      />
    </svg>
  );
}

function BudgetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
      <rect
        x="3.5"
        y="7"
        width="17"
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        className={brand}
      />
      <path
        d="M3.5 11h17"
        stroke="currentColor"
        strokeWidth="1.6"
        className={brand}
      />
      <path
        d="M16 7V6.2A2.2 2.2 0 0 0 13.8 4h-3.6A2.2 2.2 0 0 0 8 6.2V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className={brand}
      />
    </svg>
  );
}

function InvestIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
      <path
        d="M5 17.5V13M10 17.5V10M15 17.5V12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className={brand}
      />
      <path
        d="M8 8.5 13 6l3 2.5 4-4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={brand}
      />
      <path
        d="M16.5 4H20v3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={brand}
      />
    </svg>
  );
}

function RetireIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
      <path
        d="M12 4.5c3.2 0 5.8 1.6 5.8 3.6S15.2 11.7 12 11.7 6.2 10.1 6.2 8.1 8.8 4.5 12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        className={brand}
      />
      <path
        d="M12 4.5v7.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className={brand}
      />
      <path
        d="M7 14.5c2.2-1.4 7.8-1.4 10 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className={brand}
      />
      <path
        d="M7 14.5 6 19.5M17 14.5l1 5M8.2 19.5h7.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={brand}
      />
    </svg>
  );
}

const ICONS: Record<NavCategory, () => ReactElement> = {
  home: HomeIcon,
  budget: BudgetIcon,
  retire: RetireIcon,
  invest: InvestIcon,
};

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
        "nav-category-icon",
        `nav-category-icon--${category}`,
        className,
      )}
    >
      <Icon />
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
