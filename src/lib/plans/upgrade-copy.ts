import type { PlanFeature, PlanLimitedResource } from "@/types/plan";

export type PremiumUpgradeReason =
  | { type: "limit"; resource: PlanLimitedResource }
  | { type: "open"; resource: PlanLimitedResource }
  | { type: "feature"; feature: PlanFeature };

type UpgradeCopy = {
  title: string;
  description: string;
  ctaLabel: string;
};

const RESOURCE_LABELS: Record<
  PlanLimitedResource,
  { singular: string; plural: string }
> = {
  portfolio: { singular: "portfolio", plural: "portfolios" },
  retirement: { singular: "retirement plan", plural: "retirement plans" },
  budget: { singular: "budget plan", plural: "budget plans" },
  watchlist: { singular: "watchlist", plural: "watchlists" },
};

const OPEN_COPY: Record<PlanLimitedResource, UpgradeCopy> = {
  portfolio: {
    title: "Upgrade to Premium to open more portfolios",
    description:
      "Free can actively use only your Primary portfolio. Extra portfolios stay listed so you can delete them, but opening them requires Premium.",
    ctaLabel: "Upgrade to Premium",
  },
  retirement: {
    title: "Upgrade to Premium to open more retirement plans",
    description:
      "Free can open only 1 retirement plan. Extra plans stay listed so you can delete them, but opening them requires Premium.",
    ctaLabel: "Upgrade to Premium",
  },
  budget: {
    title: "Upgrade to Premium to open more budget plans",
    description:
      "Free can open only 1 budget plan. Extra plans stay listed so you can delete them, but opening them requires Premium.",
    ctaLabel: "Upgrade to Premium",
  },
  watchlist: {
    title: "Upgrade to Premium to open more watchlists",
    description:
      "Free can open only 1 watchlist. Extra watchlists stay listed so you can delete them, but opening them requires Premium.",
    ctaLabel: "Upgrade to Premium",
  },
};

const FEATURE_COPY: Record<PlanFeature, UpgradeCopy> = {
  unlimited_portfolios: {
    title: "Upgrade to Premium for unlimited portfolios",
    description:
      "Free includes 1 portfolio. Upgrade to Premium for unlimited portfolios and upcoming Premium features.",
    ctaLabel: "Upgrade to Premium",
  },
  unlimited_retirement_plans: {
    title: "Upgrade to Premium for unlimited retirement plans",
    description:
      "Free includes 1 retirement plan. Upgrade to Premium for unlimited retirement plans and upcoming Premium features.",
    ctaLabel: "Upgrade to Premium",
  },
  unlimited_budget_plans: {
    title: "Upgrade to Premium for unlimited budget plans",
    description:
      "Free includes 1 budget plan. Upgrade to Premium for unlimited budget plans and upcoming Premium features.",
    ctaLabel: "Upgrade to Premium",
  },
  unlimited_watchlists: {
    title: "Upgrade to Premium for unlimited watchlists",
    description:
      "Free includes 1 watchlist. Upgrade to Premium for unlimited watchlists and upcoming Premium features.",
    ctaLabel: "Upgrade to Premium",
  },
  retirement_from_portfolio: {
    title: "Upgrade to Premium to create from a portfolio",
    description:
      "Creating a retirement plan from an existing portfolio is a Premium feature. Free users can still create one retirement plan manually.",
    ctaLabel: "Upgrade to Premium",
  },
  full_ai_chat: {
    title: "Upgrade to Premium for full AI chat",
    description:
      "Full AI chat is a Premium feature. Upgrade to Premium to unlock deeper assistant conversations.",
    ctaLabel: "Upgrade to Premium",
  },
  full_market_themes: {
    title: "Upgrade to Premium for full market themes",
    description:
      "Full market themes are a Premium feature. Upgrade to Premium for the complete market research experience.",
    ctaLabel: "Upgrade to Premium",
  },
  plaid_integration: {
    title: "Upgrade to Premium for bank connections",
    description:
      "Plaid bank connections are a Premium feature. Upgrade to Premium when this rolls out for your account.",
    ctaLabel: "Upgrade to Premium",
  },
  ai_portfolio_insights: {
    title: "Upgrade to Premium for deeper portfolio intelligence",
    description:
      "Free includes rules-based allocation, concentration, and risk insights on your Primary portfolio. Premium will unlock deeper analysis and AI explanations as they roll out.",
    ctaLabel: "Upgrade to Premium",
  },
};

export function getLimitedResourceLabels(resource: PlanLimitedResource) {
  return RESOURCE_LABELS[resource];
}

export function getPremiumUpgradeCopy(
  reason: PremiumUpgradeReason,
): UpgradeCopy {
  if (reason.type === "feature") {
    return FEATURE_COPY[reason.feature];
  }
  if (reason.type === "open") {
    return OPEN_COPY[reason.resource];
  }

  const { singular, plural } = RESOURCE_LABELS[reason.resource];
  return {
    title: `Upgrade to Premium for unlimited ${plural}`,
    description: `Free includes 1 ${singular}. Upgrade to Premium for unlimited ${plural} and upcoming features like deeper AI insights and bank connections.`,
    ctaLabel: "Upgrade to Premium",
  };
}

export function planLimitFeature(
  resource: PlanLimitedResource,
): PlanFeature {
  if (resource === "portfolio") return "unlimited_portfolios";
  if (resource === "retirement") return "unlimited_retirement_plans";
  if (resource === "watchlist") return "unlimited_watchlists";
  return "unlimited_budget_plans";
}
