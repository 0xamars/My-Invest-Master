import {
  computeMonthSummary,
  getCurrentMonthKey,
} from "@/lib/budget/calculations";
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
 * Most recently updated plan. Caps are not enforced, so leftover is not
 * pinned to a Free-tier “allowed” plan.
 */
export function pickOpenablePlan<
  T extends { id: string; createdAt: string; updatedAt: string },
>(plans: T[]): T | null {
  return latestPlan(plans);
}

/** Ready to Assign for the viewed month. Null when there is no leftover. */
export function leftoverFromBudgetPlan(
  plan: BudgetPlan | null | undefined,
  monthKey: string = getCurrentMonthKey(),
): LeftoverSnapshot | null {
  const presence = leftoverPresenceFromBudgetPlan(plan, monthKey);
  return presence.status === "present"
    ? {
        amount: presence.amount,
        currency: presence.currency,
        budgetPlanId: presence.budgetPlanId,
      }
    : null;
}

export function leftoverFromBudgetPlans(
  plans: BudgetPlan[],
  monthKey?: string,
): LeftoverSnapshot | null {
  return leftoverFromBudgetPlan(pickOpenablePlan(plans), monthKey);
}

export type LeftoverPresence =
  | { status: "missing-budget" }
  | {
      status: "none";
      budgetPlanId: string;
      currency: BudgetCurrency;
    }
  | {
      status: "present";
      amount: number;
      currency: BudgetCurrency;
      budgetPlanId: string;
    };

/**
 * Ready to Assign for the viewed month, including an honest missing label.
 * Does not invent a leftover amount.
 */
export function leftoverPresenceFromBudgetPlan(
  plan: BudgetPlan | null | undefined,
  monthKey: string = getCurrentMonthKey(),
): LeftoverPresence {
  if (!plan) return { status: "missing-budget" };
  const currency = plan.currency ?? "USD";
  const ready = computeMonthSummary(plan, monthKey).readyToAssign;
  if (!(ready > 0)) {
    return { status: "none", budgetPlanId: plan.id, currency };
  }
  return {
    status: "present",
    amount: ready,
    currency,
    budgetPlanId: plan.id,
  };
}

export function leftoverPresenceFromBudgetPlans(
  plans: BudgetPlan[],
  monthKey?: string,
): LeftoverPresence {
  return leftoverPresenceFromBudgetPlan(pickOpenablePlan(plans), monthKey);
}
