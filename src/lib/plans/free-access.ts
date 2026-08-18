import { PLAN_CAPS_ENFORCED } from "@/lib/plans/access";
import type { UserPlan } from "@/types/plan";

type DatedPlan = {
  id: string;
  createdAt: string;
};

type PortfolioLike = {
  id: string;
  isPrimary: boolean;
};

/**
 * Stable Free "allowed" plan: oldest by createdAt, then id.
 * Extras stay visible/deletable but are not openable when caps are on.
 */
export function pickFreeAllowedPlanId(
  plans: DatedPlan[],
): string | null {
  if (plans.length === 0) return null;

  const sorted = [...plans].sort((a, b) => {
    const byDate = a.createdAt.localeCompare(b.createdAt);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });

  return sorted[0]?.id ?? null;
}

export function canOpenPortfolioOnPlan(
  plan: UserPlan,
  portfolio: PortfolioLike | null | undefined,
): boolean {
  if (!PLAN_CAPS_ENFORCED) return true;
  if (plan === "premium") return true;
  if (!portfolio) return false;
  return portfolio.isPrimary;
}

export function canOpenRetirementPlanOnPlan(
  plan: UserPlan,
  plans: DatedPlan[],
  planId: string,
): boolean {
  if (!PLAN_CAPS_ENFORCED) return true;
  if (plan === "premium") return true;
  const allowedId = pickFreeAllowedPlanId(plans);
  return allowedId !== null && allowedId === planId;
}

export function canOpenBudgetPlanOnPlan(
  plan: UserPlan,
  plans: DatedPlan[],
  planId: string,
): boolean {
  if (!PLAN_CAPS_ENFORCED) return true;
  if (plan === "premium") return true;
  const allowedId = pickFreeAllowedPlanId(plans);
  return allowedId !== null && allowedId === planId;
}

export function canOpenWatchlistOnPlan(
  plan: UserPlan,
  lists: DatedPlan[],
  listId: string,
): boolean {
  if (!PLAN_CAPS_ENFORCED) return true;
  if (plan === "premium") return true;
  const allowedId = pickFreeAllowedPlanId(lists);
  return allowedId !== null && allowedId === listId;
}

/** Create-from-portfolio retirement import. Ungated while caps are off. */
export function canCreateRetirementFromPortfolio(plan: UserPlan): boolean {
  if (!PLAN_CAPS_ENFORCED) return true;
  return plan === "premium";
}
