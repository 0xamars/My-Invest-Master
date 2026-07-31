export const USER_PLANS = ["free", "premium"] as const;

export type UserPlan = (typeof USER_PLANS)[number];

export function isUserPlan(value: string): value is UserPlan {
  return USER_PLANS.includes(value as UserPlan);
}

/** Feature flags for Free vs Premium. Wire enforcement as products mature. */
export const PLAN_FEATURES = [
  "unlimited_retirement_plans",
  "unlimited_budget_plans",
  "retirement_from_portfolio",
  "full_ai_chat",
  "full_market_themes",
  "plaid_integration",
  "ai_portfolio_insights",
  "unlimited_portfolios",
  "unlimited_watchlists",
] as const;

export type PlanFeature = (typeof PLAN_FEATURES)[number];

export const FREE_PLAN_LIMITS = {
  retirementPlans: 1,
  budgetPlans: 1,
  portfolios: 1,
  watchlists: 1,
} as const;

export type PlanLimitedResource =
  | "retirement"
  | "budget"
  | "portfolio"
  | "watchlist";
