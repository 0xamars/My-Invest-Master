/**
 * Free vs Premium plan access.
 *
 * Create limits are enforced for portfolios, retirement, and budget.
 * Feature flags are ready for product gating — always surface
 * PremiumUpgradeDialog / usePremiumUpgradePrompt when blocking Free users.
 */
export {
  canAccess,
  canCreateLimitedResource,
  getPlanLimit,
  isPlanLimitError,
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
