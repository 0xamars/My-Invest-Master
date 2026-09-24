import {
  computeMonthSummary,
  getCurrentMonthKey,
} from "@/lib/budget/calculations";
import { leftoverMetricLabel } from "@/lib/journey/command-center";
import type { LeftoverPresence } from "@/lib/invest/leftover";
import { pickOpenablePlan } from "@/lib/invest/leftover";
import {
  BUDGET_PATH,
  INVEST_PATH,
  RETIRE_PATH,
  budgetPlanPath,
} from "@/lib/chrome/nav";
import { bindFreedomPathPlan, type BookPresence } from "@/lib/retirement/freedom-path";
import { computeRetirementDashboard } from "@/lib/retirement/dashboard";
import type { FxRates } from "@/types/currency";
import { createEmptyPlan, type RetirementPlan } from "@/types/retirement";
import type { BudgetPlan } from "@/types/budget";
import type { PortfolioHolding } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";

export const HOME_EMPTY = {
  budget: "No budget yet",
  invest: "No holdings",
  retire: "Needs leftover and a book",
  unknown: "Unknown",
} as const;

export type SignedInHomeCard = {
  pillar: "budget" | "invest" | "retire";
  title: "Budget" | "Invest" | "Retire";
  href: string;
  metric: string;
  caption: string;
  empty: boolean;
  /** 0–1 fill. Null when the block is empty — never a guessed bar. */
  spark: number | null;
};

export function clampHomeSpark(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  if (ratio >= 1) return 1;
  return ratio;
}

export function formatHomeShare(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "0%";
  return `${Math.round(ratio * 100)}%`;
}

function budgetHref(leftover: LeftoverPresence, planId: string | null): string {
  if (leftover.status === "present" || leftover.status === "none") {
    return budgetPlanPath(leftover.budgetPlanId);
  }
  if (planId) return budgetPlanPath(planId);
  return BUDGET_PATH;
}

function holdingBookValue(holding: PortfolioHolding): number {
  if (holding.type === "cash") return holding.quantity;
  const cost = holding.quantity * holding.costPrice;
  return Number.isFinite(cost) ? cost : 0;
}

/**
 * Top weight of the visible book from cost basis (or cash qty).
 * Does not invent a live quote or a pulse.
 */
export function bookTopWeight(book: BookPresence): {
  label: string;
  weight: number;
} | null {
  if (book.status !== "present") return null;
  const rows = book.holdings
    .map((holding) => ({
      label: holding.symbol || getCashCurrency(holding) || holding.name,
      value: holdingBookValue(holding),
    }))
    .filter((row) => row.value > 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (total <= 0 || rows.length === 0) return null;
  const top = [...rows].sort((a, b) => b.value - a.value)[0]!;
  return { label: top.label, weight: top.value / total };
}

export function signedInHomeBudgetInsight(
  leftover: LeftoverPresence,
  assigned: number,
  planId: string | null,
): SignedInHomeCard {
  const empty = leftover.status === "missing-budget";
  const leftoverAmount = leftover.status === "present" ? leftover.amount : 0;
  const pool = leftoverAmount + Math.max(0, assigned);
  return {
    pillar: "budget",
    title: "Budget",
    href: budgetHref(leftover, planId),
    metric: leftoverMetricLabel(leftover),
    caption: empty ? HOME_EMPTY.budget : "To assign",
    empty,
    spark: empty ? null : clampHomeSpark(pool > 0 ? leftoverAmount / pool : 0),
  };
}

export function signedInHomeInvestInsight(book: BookPresence): SignedInHomeCard {
  const top = bookTopWeight(book);
  if (!top) {
    return {
      pillar: "invest",
      title: "Invest",
      href: INVEST_PATH,
      metric: HOME_EMPTY.invest,
      caption: HOME_EMPTY.invest,
      empty: true,
      spark: null,
    };
  }
  return {
    pillar: "invest",
    title: "Invest",
    href: INVEST_PATH,
    metric: formatHomeShare(top.weight),
    caption: `Top weight · ${top.label}`,
    empty: false,
    spark: clampHomeSpark(top.weight),
  };
}

/**
 * Path progress = projected nest egg today / target.
 * Missing leftover or book is labeled — never a guessed percent.
 */
export function signedInHomeRetireInsight(input: {
  leftover: LeftoverPresence;
  book: BookPresence;
  assumptions?: RetirementPlan | null;
  currentYear?: number;
  rates?: FxRates;
}): SignedInHomeCard {
  if (input.leftover.status !== "present" || input.book.status !== "present") {
    return {
      pillar: "retire",
      title: "Retire",
      href: RETIRE_PATH,
      metric: HOME_EMPTY.retire,
      caption: HOME_EMPTY.retire,
      empty: true,
      spark: null,
    };
  }

  const assumptions = input.assumptions ?? createEmptyPlan("Retire");
  const path = bindFreedomPathPlan(
    assumptions,
    input.leftover,
    input.book,
    {},
    input.rates,
  );
  const dashboard = computeRetirementDashboard(path, {
    currentYear: input.currentYear,
  });

  if (
    dashboard.projectedNestEggToday == null ||
    dashboard.targetNestEgg == null ||
    dashboard.targetNestEgg <= 0
  ) {
    return {
      pillar: "retire",
      title: "Retire",
      href: RETIRE_PATH,
      metric: HOME_EMPTY.unknown,
      caption: "Path to target",
      empty: true,
      spark: null,
    };
  }

  const ratio = dashboard.projectedNestEggToday / dashboard.targetNestEgg;
  return {
    pillar: "retire",
    title: "Retire",
    href: RETIRE_PATH,
    metric: formatHomeShare(ratio),
    caption: "Path to target",
    empty: false,
    spark: clampHomeSpark(ratio),
  };
}

export function signedInHomeAssignedFromPlans(
  plans: readonly BudgetPlan[],
  monthKey: string = getCurrentMonthKey(),
): { assigned: number; planId: string | null } {
  const plan = pickOpenablePlan([...plans]);
  if (!plan) return { assigned: 0, planId: null };
  return {
    assigned: computeMonthSummary(plan, monthKey).totalAssigned,
    planId: plan.id,
  };
}

/**
 * Three insight blocks only. One number + one spark each.
 * Never invents leftover, a book weight, or a Retire percent.
 */
export function buildSignedInHomeCards(input: {
  leftover: LeftoverPresence;
  book: BookPresence;
  assigned?: number;
  budgetPlanId?: string | null;
  assumptions?: RetirementPlan | null;
  currentYear?: number;
  rates?: FxRates;
}): SignedInHomeCard[] {
  return [
    signedInHomeBudgetInsight(
      input.leftover,
      input.assigned ?? 0,
      input.budgetPlanId ?? null,
    ),
    signedInHomeInvestInsight(input.book),
    signedInHomeRetireInsight({
      leftover: input.leftover,
      book: input.book,
      assumptions: input.assumptions,
      currentYear: input.currentYear,
      rates: input.rates,
    }),
  ];
}
