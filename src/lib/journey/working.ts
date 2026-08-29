import { leftoverPresenceFromBudgetPlan } from "@/lib/invest/leftover";
import { isLessonComplete } from "@/lib/journey/profile";
import { bookPresenceFromPortfolio } from "@/lib/retirement/freedom-path";
import type { BudgetPlan } from "@/types/budget";
import type {
  CompletedLessons,
  MoneyProfile,
  MoneyProfileFlags,
  MoneyProfileWorking,
} from "@/types/money-profile";
import type { PortfolioHolding } from "@/types/portfolio";

/** Invest construction lesson that can mark Invest working without holdings. */
export const INVEST_CONSTRUCTION_LESSON_ID = "invest-the-book";

export type WorkingBook = {
  id: string;
  name: string;
  holdings: PortfolioHolding[];
} | null;

export type WorkingLiveInput = {
  flags: MoneyProfileFlags;
  completedLessons: CompletedLessons;
  budgetPlans: readonly BudgetPlan[];
  primaryBook: WorkingBook;
  freedomPlans: readonly { id: string }[];
};

function planHasAssignedLeftover(plan: BudgetPlan): boolean {
  return Object.values(plan.monthBudgets).some((month) =>
    Object.values(month.assignments).some((amount) => amount !== 0),
  );
}

function planHasClosedMonth(plan: BudgetPlan): boolean {
  if (typeof plan.closedThrough === "string" && plan.closedThrough.length > 0) {
    return true;
  }
  return Object.values(plan.monthBudgets).some(
    (month) => typeof month.closedAt === "string" && month.closedAt.length > 0,
  );
}

/**
 * Real leftover from Budget — present Ready to Assign, or leftover already
 * given a job. Never invents an amount.
 */
export function leftoverAssignedFromBudgetPlans(
  plans: readonly BudgetPlan[],
): boolean {
  return plans.some(
    (plan) =>
      leftoverPresenceFromBudgetPlan(plan).status === "present" ||
      planHasAssignedLeftover(plan),
  );
}

/** Explicit month close only. Legacy implicit close is not “working.” */
export function monthClosedFromBudgetPlans(
  plans: readonly BudgetPlan[],
): boolean {
  return plans.some(planHasClosedMonth);
}

export function bookHasHolding(primaryBook: WorkingBook): boolean {
  return bookPresenceFromPortfolio(primaryBook).status === "present";
}

export function freedomPlanIsSaved(
  freedomPlans: readonly { id: string }[],
): boolean {
  return freedomPlans.length > 0;
}

/**
 * Derive working flags from live Budget / Invest / Freedom data.
 * Does not invent leftover, holdings, or a Freedom plan.
 */
export function deriveWorkingFlags(input: WorkingLiveInput): MoneyProfileWorking {
  const leftoverAssigned = leftoverAssignedFromBudgetPlans(input.budgetPlans);
  const monthClosed = monthClosedFromBudgetPlans(input.budgetPlans);
  const hasBook = bookHasHolding(input.primaryBook);
  const constructionLessonDone = isLessonComplete(
    { completedLessons: input.completedLessons },
    INVEST_CONSTRUCTION_LESSON_ID,
  );

  return {
    budget:
      leftoverAssigned || monthClosed || input.flags.budgetElsewhere,
    invest:
      hasBook ||
      (input.flags.investNoHoldingsYet && constructionLessonDone),
    freedom: freedomPlanIsSaved(input.freedomPlans),
  };
}

export function workingFlagsEqual(
  a: MoneyProfileWorking,
  b: MoneyProfileWorking,
): boolean {
  return (
    a.budget === b.budget && a.invest === b.invest && a.freedom === b.freedom
  );
}

export function withDerivedWorking(
  profile: MoneyProfile,
  working: MoneyProfileWorking,
): MoneyProfile {
  if (workingFlagsEqual(profile.working, working)) return profile;
  return { ...profile, working };
}
