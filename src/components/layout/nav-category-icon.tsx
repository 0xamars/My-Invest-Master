import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NavCategory = "home" | "budget" | "retire" | "invest";

const iconClass = "size-3.5";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
      <path
        d="M4.5 10.5 12 4.5l7.5 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[oklch(0.58_0.17_152)] dark:text-[oklch(0.76_0.16_152)]"
      />
      <path
        d="M6.5 9.5V18a1.5 1.5 0 0 0 1.5 1.5H10v-4.5h4V19.5h2a1.5 1.5 0 0 0 1.5-1.5V9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[oklch(0.58_0.17_152)] dark:text-[oklch(0.76_0.16_152)]"
      />
      <path
        d="M12 4.5v3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        className="text-[oklch(0.62_0.22_27)]"
      />
    </svg>
  );
}

function BudgetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="3"
        className="fill-[oklch(0.67_0.19_152)]"
        opacity="0.18"
      />
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.6"
        className="text-[oklch(0.58_0.17_152)] dark:text-[oklch(0.76_0.16_152)]"
      />
      <circle
        cx="12"
        cy="12.5"
        r="3.25"
        stroke="currentColor"
        strokeWidth="1.6"
        className="text-[oklch(0.58_0.17_152)] dark:text-[oklch(0.76_0.16_152)]"
      />
      <path
        d="M12 10.5v4M10.75 12.5h2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        className="text-[oklch(0.62_0.22_27)]"
      />
    </svg>
  );
}

function RetireIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
      <path
        d="M4 17.5h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="text-[oklch(0.58_0.17_152)] dark:text-[oklch(0.76_0.16_152)]"
      />
      <path
        d="M6.5 17.5V11a5.5 5.5 0 0 1 11 0v6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="text-[oklch(0.58_0.17_152)] dark:text-[oklch(0.76_0.16_152)]"
      />
      <circle
        cx="17.5"
        cy="7"
        r="2.75"
        className="fill-[oklch(0.78_0.19_55)]"
      />
      <path
        d="M8 14.5h8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        className="text-[oklch(0.62_0.22_27)]"
      />
    </svg>
  );
}

function InvestIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden>
      <path
        d="M4 16.5 8.5 11l3 2.5L17 6.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[oklch(0.58_0.17_152)] dark:text-[oklch(0.76_0.16_152)]"
      />
      <path
        d="M13.5 6.5H17V10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[oklch(0.58_0.17_152)] dark:text-[oklch(0.76_0.16_152)]"
      />
      <path
        d="M14.5 14.5c1.8-2.8 3.6-3.8 5.5-3.2.8.2 1.4.9 1.5 1.8.2 1.6-1.2 3.2-3.1 3.6-1.9.4-3.4-.4-3.9-2.2Z"
        className="fill-[oklch(0.62_0.22_27)]"
      />
      <path
        d="M17.5 11.5c.3-.8.9-1.2 1.6-1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="text-[oklch(0.78_0.19_55)]"
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
