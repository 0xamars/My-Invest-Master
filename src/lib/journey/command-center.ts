import { formatBudgetMoney } from "@/lib/budget/format";
import { previewMonthClose } from "@/lib/budget/month-close";
import { isMonthClosed } from "@/lib/budget/closed-months";
import { getCurrentMonthKey } from "@/lib/budget/calculations";
import { budgetPlanPath } from "@/lib/chrome/nav";
import type { LeftoverPresence } from "@/lib/invest/leftover";
import { pickOpenablePlan } from "@/lib/invest/leftover";
import { FREEDOM_DATE_NEEDS_INPUTS } from "@/lib/journey/freedom-date";
import { isLessonComplete } from "@/lib/journey/profile";
import { leftoverAssignedFromBudgetPlans } from "@/lib/journey/working";
import {
  JOURNEY_PILLARS,
  type JourneyPillar,
  type MoneyProfile,
} from "@/types/money-profile";
import { lessonsForPillar } from "@/lib/journey/lessons";
import { pillarTabHref } from "@/lib/journey/tabs";
import {
  primaryNextAction,
  type JourneyNextAction,
  type JourneyStation,
} from "@/lib/journey/stations";
import type { BudgetPlan } from "@/types/budget";
import type { BookPresence } from "@/lib/retirement/freedom-path";
import { formatCurrency } from "@/lib/portfolio/format";
import type { DisplayCurrency } from "@/types/currency";

export const JOURNEY_HOME_METRIC_EMPTY = {
  leftover: "No budget yet",
  book: "No holdings",
  freedom: FREEDOM_DATE_NEEDS_INPUTS,
} as const;

export type CommandCenterLive = {
  hasBudgetPlan: boolean;
  leftover: LeftoverPresence;
  monthCloseReady: boolean;
  hasHoldings: boolean;
  hasFreedomPlan: boolean;
  budgetWorking: boolean;
  budgetPlanId: string | null;
};

/**
 * Close month is the next job only when leftover is already given a job,
 * the month is still open, and the existing close preview says it can close.
 * Does not change leftover / close math.
 */
export function monthCloseIsReadyNextStep(input: {
  plan: BudgetPlan | null;
  leftover: LeftoverPresence;
  monthKey?: string;
  today?: Date;
}): boolean {
  const { plan, leftover } = input;
  if (!plan) return false;
  if (leftover.status === "missing-budget" || leftover.status === "present") {
    return false;
  }
  if (!leftoverAssignedFromBudgetPlans([plan])) return false;
  const monthKey = input.monthKey ?? getCurrentMonthKey();
  if (isMonthClosed(plan, monthKey)) return false;
  return previewMonthClose(plan, monthKey, input.today).canClose;
}

export function commandCenterLiveFromPlans(input: {
  budgetPlans: readonly BudgetPlan[];
  leftover: LeftoverPresence;
  hasHoldings: boolean;
  hasFreedomPlan: boolean;
  budgetWorking: boolean;
  monthKey?: string;
  today?: Date;
}): CommandCenterLive {
  const plan = pickOpenablePlan([...input.budgetPlans]);
  return {
    hasBudgetPlan: input.budgetPlans.length > 0,
    leftover: input.leftover,
    monthCloseReady: monthCloseIsReadyNextStep({
      plan,
      leftover: input.leftover,
      monthKey: input.monthKey,
      today: input.today,
    }),
    hasHoldings: input.hasHoldings,
    hasFreedomPlan: input.hasFreedomPlan,
    budgetWorking: input.budgetWorking,
    budgetPlanId: plan?.id ?? null,
  };
}

function budgetDoHref(planId: string | null): string {
  return planId ? budgetPlanPath(planId) : pillarTabHref("budget", "do");
}

/**
 * One primary next step from live Budget / Invest / Freedom state.
 * Never labels the action “Continue”. Never invents leftover, a book, or a date.
 */
export function commandCenterNextAction(
  profile: MoneyProfile,
  live: CommandCenterLive,
): JourneyNextAction {
  if (!live.hasBudgetPlan) {
    return {
      pillar: "budget",
      href: pillarTabHref("budget", "do"),
      label: "Create a budget",
    };
  }

  if (live.leftover.status === "present") {
    return {
      pillar: "budget",
      href: budgetDoHref(live.leftover.budgetPlanId),
      label: "Assign leftover",
    };
  }

  if (live.monthCloseReady) {
    return {
      pillar: "budget",
      href: budgetDoHref(live.budgetPlanId),
      label: "Close month",
    };
  }

  if (live.budgetWorking && !live.hasHoldings) {
    return {
      pillar: "invest",
      href: pillarTabHref("invest", "do"),
      label: "Add a holding",
    };
  }

  if (live.hasHoldings && !live.hasFreedomPlan) {
    return {
      pillar: "freedom",
      href: pillarTabHref("freedom", "do"),
      label: "Open Freedom",
    };
  }

  return primaryNextAction(profile, { hasBook: live.hasHoldings });
}

export function stationCardHref(station: JourneyStation): string {
  if (station.status === "learn" || station.status === "locked") {
    return station.learnHref;
  }
  return station.doHref;
}

export function leftoverMetricLabel(leftover: LeftoverPresence): string {
  if (leftover.status === "missing-budget") {
    return JOURNEY_HOME_METRIC_EMPTY.leftover;
  }
  if (leftover.status === "none") {
    return formatBudgetMoney(0, leftover.currency);
  }
  return formatBudgetMoney(leftover.amount, leftover.currency);
}

/** Cost basis of visible holdings. Does not invent a live quote. */
export function bookMetricLabel(
  book: BookPresence,
  currency: DisplayCurrency = "USD",
): string {
  if (book.status !== "present") return JOURNEY_HOME_METRIC_EMPTY.book;
  const amount = book.holdings.reduce((sum, holding) => {
    if (holding.type === "cash") return sum + holding.quantity;
    return sum + holding.quantity * holding.costPrice;
  }, 0);
  return formatCurrency(amount, currency);
}

export function stationMetricLabel(
  pillar: JourneyPillar,
  leftover: LeftoverPresence,
  book: BookPresence,
  freedomLabel: string,
): string {
  if (pillar === "budget") return leftoverMetricLabel(leftover);
  if (pillar === "invest") return bookMetricLabel(book);
  return freedomLabel || JOURNEY_HOME_METRIC_EMPTY.freedom;
}

export type NextLessonRef = {
  pillar: JourneyPillar;
  title: string;
  href: string;
};

/** First incomplete lesson after real learn progress. Omit when none. */
export function nextLessonFromProgress(
  profile: MoneyProfile,
): NextLessonRef | null {
  const hasProgress = Object.values(profile.completedLessons).some(Boolean);
  if (!hasProgress) return null;

  for (const pillar of JOURNEY_PILLARS) {
    for (const lesson of lessonsForPillar(pillar)) {
      if (!isLessonComplete(profile, lesson.id)) {
        return {
          pillar,
          title: lesson.title,
          href: pillarTabHref(pillar, "learn", lesson.id),
        };
      }
    }
  }
  return null;
}
