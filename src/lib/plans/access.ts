import {
  FREE_PLAN_LIMITS,
  type PlanFeature,
  type PlanLimitedResource,
  type UserPlan,
} from "@/types/plan";
import { getPremiumUpgradeCopy } from "@/lib/plans/upgrade-copy";

/**
 * Caps and Free/Premium feature gates are off. Keep the tables so a cap
 * can return later — do not enforce any limit now.
 */
export const PLAN_CAPS_ENFORCED = false;

/** Always treated as Premium in the app (billing not required). */
export const PREMIUM_OVERRIDE_EMAILS = ["admin@investsalsa.com"] as const;

const FREE_FEATURE_ACCESS: Record<PlanFeature, boolean> = {
  unlimited_retirement_plans: false,
  unlimited_budget_plans: false,
  retirement_from_portfolio: false,
  full_ai_chat: false,
  full_market_themes: false,
  plaid_integration: false,
  ai_portfolio_insights: false,
  unlimited_portfolios: false,
  unlimited_watchlists: false,
};

const PREMIUM_FEATURE_ACCESS: Record<PlanFeature, boolean> = {
  unlimited_retirement_plans: true,
  unlimited_budget_plans: true,
  retirement_from_portfolio: true,
  full_ai_chat: true,
  full_market_themes: true,
  plaid_integration: true,
  ai_portfolio_insights: true,
  unlimited_portfolios: true,
  unlimited_watchlists: true,
};

function parseEmailList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isPremiumOverrideEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;

  if (
    PREMIUM_OVERRIDE_EMAILS.some(
      (override) => override.toLowerCase() === normalized,
    )
  ) {
    return true;
  }

  return parseEmailList(process.env.NEXT_PUBLIC_PREMIUM_OVERRIDE_EMAILS).includes(
    normalized,
  );
}

/**
 * Resolve the effective plan for access checks.
 * Priority: NEXT_PUBLIC_PLAN_OVERRIDE → premium override emails → stored plan → free.
 */
export function resolveEffectivePlan(
  email: string | null | undefined,
  storedPlan: UserPlan | null | undefined,
): UserPlan {
  const envOverride = process.env.NEXT_PUBLIC_PLAN_OVERRIDE?.trim().toLowerCase();
  if (envOverride === "free" || envOverride === "premium") {
    return envOverride;
  }

  if (isPremiumOverrideEmail(email)) {
    return "premium";
  }

  return storedPlan === "premium" ? "premium" : "free";
}

export function canAccess(plan: UserPlan, feature: PlanFeature): boolean {
  if (!PLAN_CAPS_ENFORCED) return true;
  const table =
    plan === "premium" ? PREMIUM_FEATURE_ACCESS : FREE_FEATURE_ACCESS;
  return table[feature];
}

export function getPlanLimit(
  plan: UserPlan,
  resource: PlanLimitedResource,
): number | null {
  if (!PLAN_CAPS_ENFORCED) return null;
  if (plan === "premium") return null;

  if (resource === "retirement") return FREE_PLAN_LIMITS.retirementPlans;
  if (resource === "budget") return FREE_PLAN_LIMITS.budgetPlans;
  if (resource === "watchlist") return FREE_PLAN_LIMITS.watchlists;
  return FREE_PLAN_LIMITS.portfolios;
}

export function canCreateLimitedResource(
  plan: UserPlan,
  resource: PlanLimitedResource,
  currentCount: number,
): boolean {
  const limit = getPlanLimit(plan, resource);
  if (limit === null) return true;
  return currentCount < limit;
}

/**
 * Resolve the plan used for Free/Premium create gates.
 * Returns null while preferences are still loading (callers should wait).
 * After a prefs load failure, fails closed as Free without pruning data.
 */
export function resolvePlanForCreateGate(
  plan: UserPlan,
  options: {
    isPlanLoaded: boolean;
    prefsLoadSucceeded: boolean;
  },
): UserPlan | null {
  if (!options.isPlanLoaded) return null;
  return options.prefsLoadSucceeded ? plan : "free";
}

export function planDisplayName(plan: UserPlan): string {
  return plan === "premium" ? "Premium" : "Free";
}

export class PlanLimitError extends Error {
  readonly resource: PlanLimitedResource;
  readonly code = "PLAN_LIMIT" as const;

  constructor(resource: PlanLimitedResource) {
    super(
      getPremiumUpgradeCopy({ type: "limit", resource }).description,
    );
    this.name = "PlanLimitError";
    this.resource = resource;
  }
}

export function isPlanLimitError(error: unknown): error is PlanLimitError {
  return error instanceof PlanLimitError;
}
