import {
  computeMonthSummary,
  getCurrentMonthKey,
} from "@/lib/budget/calculations";
import { pickFreeAllowedPlanId } from "@/lib/plans/free-access";
import type { BudgetCurrency, BudgetPlan } from "@/types/budget";

export interface LeftoverSnapshot {
  amount: number;
  currency: BudgetCurrency;
  budgetPlanId: string;
}

function latestPlan<T extends { updatedAt: string }>(plans: T[]): T | null {
  if (plans.length === 0) return null;
  return [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
}

/**
 * Same openable-plan picker Home and Invest already use: Free's allowed
 * plan, else the most recently updated. Does not invent a leftover amount.
 */
export function pickOpenablePlan<
  T extends { id: string; createdAt: string; updatedAt: string },
>(plans: T[]): T | null {
  const allowedId = pickFreeAllowedPlanId(plans);
  return plans.find((plan) => plan.id === allowedId) ?? latestPlan(plans);
}

/** Ready to Assign for the viewed month. Null when there is no leftover. */
export function leftoverFromBudgetPlan(
  plan: BudgetPlan | null | undefined,
  monthKey: string = getCurrentMonthKey(),
): LeftoverSnapshot | null {
  if (!plan) return null;
  const ready = computeMonthSummary(plan, monthKey).readyToAssign;
  if (!(ready > 0)) return null;
  return {
    amount: ready,
    currency: plan.currency ?? "USD",
    budgetPlanId: plan.id,
  };
}

export function leftoverFromBudgetPlans(
  plans: BudgetPlan[],
  monthKey?: string,
): LeftoverSnapshot | null {
  return leftoverFromBudgetPlan(pickOpenablePlan(plans), monthKey);
}
