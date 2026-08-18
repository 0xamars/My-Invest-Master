/**
 * Plan access tables stay so a cap can return later.
 * Enforcement is off — see PLAN_CAPS_ENFORCED.
 */
export {
  canAccess,
  canCreateLimitedResource,
  getPlanLimit,
  isPlanLimitError,
  PLAN_CAPS_ENFORCED,
  planDisplayName,
  PlanLimitError,
  PREMIUM_OVERRIDE_EMAILS,
  resolveEffectivePlan,
  resolvePlanForCreateGate,
} from "@/lib/plans/access";

export {
  getLimitedResourceLabels,
  getPremiumUpgradeCopy,
  planLimitFeature,
  type PremiumUpgradeReason,
} from "@/lib/plans/upgrade-copy";

export {
  canCreateRetirementFromPortfolio,
  canOpenBudgetPlanOnPlan,
  canOpenPortfolioOnPlan,
  canOpenRetirementPlanOnPlan,
  pickFreeAllowedPlanId,
} from "@/lib/plans/free-access";

export {
  FREE_PLAN_FEATURES,
  PREMIUM_PLAN_FEATURES,
  PREMIUM_SUPPORT_EMAIL,
  PRICING_DISCLAIMER,
  PRICING_PATH,
} from "@/lib/plans/pricing";
