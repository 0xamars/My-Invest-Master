import { leftoverAssignedFromBudgetPlans, monthClosedFromBudgetPlans } from "@/lib/journey/working";
import {
  bookMetricLabel,
  leftoverMetricLabel,
  type CommandCenterLive,
} from "@/lib/journey/command-center";
import type { JourneyFreedomDate } from "@/lib/journey/freedom-date";
import type { LeftoverPresence } from "@/lib/invest/leftover";
import {
  BUDGET_PATH,
  INVEST_PATH,
  RETIRE_PATH,
  budgetPlanPath,
} from "@/lib/chrome/nav";
import type { JourneyNextAction } from "@/lib/journey/stations";
import type { BookPresence } from "@/lib/retirement/freedom-path";
import type { BudgetPlan } from "@/types/budget";

export type SignedInHomeCard = {
  pillar: "budget" | "invest" | "retire";
  title: "Budget" | "Invest" | "Retire";
  href: string;
  metric: string;
  caption: string;
  empty: boolean;
};

export function signedInHomeBudgetWorking(
  plans: readonly BudgetPlan[],
): boolean {
  return leftoverAssignedFromBudgetPlans(plans) || monthClosedFromBudgetPlans(plans);
}

function budgetHref(leftover: LeftoverPresence, planId: string | null): string {
  if (leftover.status === "present") return budgetPlanPath(leftover.budgetPlanId);
  if (leftover.status === "none") return budgetPlanPath(leftover.budgetPlanId);
  if (planId) return budgetPlanPath(planId);
  return BUDGET_PATH;
}

/**
 * One next step from live Budget / Invest / Retire state only.
 * Missing inputs stay labeled. Never invents leftover, a book, or a date.
 * Returns null when there is no honest gap to close.
 */
export function signedInHomeNextAction(
  live: CommandCenterLive,
): JourneyNextAction | null {
  if (!live.hasBudgetPlan) {
    return {
      pillar: "budget",
      href: BUDGET_PATH,
      label: "Create a budget",
    };
  }

  if (live.leftover.status === "present") {
    return {
      pillar: "budget",
      href: budgetHref(live.leftover, live.budgetPlanId),
      label: "Assign leftover",
    };
  }

  if (live.monthCloseReady) {
    return {
      pillar: "budget",
      href: budgetHref(live.leftover, live.budgetPlanId),
      label: "Close month",
    };
  }

  if (live.budgetWorking && !live.hasHoldings) {
    return {
      pillar: "invest",
      href: INVEST_PATH,
      label: "Add a holding",
    };
  }

  if (live.hasHoldings && !live.hasFreedomPlan) {
    return {
      pillar: "freedom",
      href: RETIRE_PATH,
      label: "Open Retire",
    };
  }

  return null;
}

export function signedInHomeBudgetCaption(leftover: LeftoverPresence): string {
  if (leftover.status === "missing-budget") return "Open Budget to start.";
  return "Ready to Assign this month.";
}

export function signedInHomeInvestCaption(book: BookPresence): string {
  if (book.status !== "present") return "Open Invest to name the book.";
  return "Book cost basis. Not a live quote.";
}

export function signedInHomeRetireCaption(freedom: JourneyFreedomDate): string {
  if (freedom.status === "needs-inputs") {
    return "A date needs leftover and the book.";
  }
  return "From leftover and the book.";
}

/**
 * Three honest pillar cards. Metrics come from leftover, book cost, and the
 * leftover+book Retire date — never invented income, positions, or a year.
 */
export function buildSignedInHomeCards(input: {
  leftover: LeftoverPresence;
  book: BookPresence;
  freedom: JourneyFreedomDate;
  budgetPlanId?: string | null;
}): SignedInHomeCard[] {
  return [
    {
      pillar: "budget",
      title: "Budget",
      href: budgetHref(input.leftover, input.budgetPlanId ?? null),
      metric: leftoverMetricLabel(input.leftover),
      caption: signedInHomeBudgetCaption(input.leftover),
      empty: input.leftover.status === "missing-budget",
    },
    {
      pillar: "invest",
      title: "Invest",
      href: INVEST_PATH,
      metric: bookMetricLabel(input.book),
      caption: signedInHomeInvestCaption(input.book),
      empty: input.book.status !== "present",
    },
    {
      pillar: "retire",
      title: "Retire",
      href: RETIRE_PATH,
      metric: input.freedom.label,
      caption: signedInHomeRetireCaption(input.freedom),
      empty: input.freedom.status === "needs-inputs",
    },
  ];
}
