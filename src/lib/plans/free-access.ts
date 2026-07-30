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
 * Extras stay visible/deletable but are not openable on Free.
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
  if (plan === "premium") return true;
  if (!portfolio) return false;
  return portfolio.isPrimary;
}

export function canOpenRetirementPlanOnPlan(
  plan: UserPlan,
  plans: DatedPlan[],
  planId: string,
): boolean {
  if (plan === "premium") return true;
  const allowedId = pickFreeAllowedPlanId(plans);
  return allowedId !== null && allowedId === planId;
}

export function canOpenBudgetPlanOnPlan(
  plan: UserPlan,
  plans: DatedPlan[],
  planId: string,
): boolean {
  if (plan === "premium") return true;
  const allowedId = pickFreeAllowedPlanId(plans);
  return allowedId !== null && allowedId === planId;
}

/** Create-from-portfolio retirement import is Premium-only. */
export function canCreateRetirementFromPortfolio(plan: UserPlan): boolean {
  return plan === "premium";
}
