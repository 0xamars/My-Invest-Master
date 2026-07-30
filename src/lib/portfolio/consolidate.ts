import type { UserPlan } from "@/types/plan";
import type { UserPortfolio } from "@/types/portfolio";

function ensureSinglePrimary(portfolios: UserPortfolio[]): UserPortfolio[] {
  if (portfolios.length === 0) return portfolios;

  const primaryIndex = portfolios.findIndex((portfolio) => portfolio.isPrimary);
  const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

  return portfolios.map((portfolio, index) => ({
    ...portfolio,
    isPrimary: index === resolvedPrimaryIndex,
  }));
}

function holdingCount(portfolio: UserPortfolio): number {
  return portfolio.holdings.length;
}

/**
 * Choose which portfolio to keep when a Free user must reduce to one.
 *
 * Priority:
 * 1) most holdings / richest data
 * 2) Primary flag
 * 3) most recently updated
 *
 * Never prefers an empty Primary over a portfolio that has holdings.
 */
export function pickPortfolioToKeep(portfolios: UserPortfolio[]): UserPortfolio {
  if (portfolios.length === 0) {
    throw new Error("Cannot pick a portfolio from an empty list.");
  }

  return [...portfolios].sort((a, b) => {
    const holdingDiff = holdingCount(b) - holdingCount(a);
    if (holdingDiff !== 0) return holdingDiff;

    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1;
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  })[0];
}

export type PortfolioConsolidationResult = {
  /** Portfolios to keep in app state (never silently emptied). */
  keep: UserPortfolio[];
  /**
   * IDs that would be removed if a destructive consolidate were confirmed.
   * Automatic load paths must ignore this and never delete without explicit UX.
   */
  surplusIds: string[];
  /** Suggested keeper when surplusIds is non-empty. */
  suggestedKeeperId: string | null;
};

/**
 * Analyze Free-tier surplus portfolios without deleting anything.
 *
 * Free limits are enforced by blocking create. Existing extras are left intact
 * until the user explicitly deletes them (or confirms a future cleanup flow).
 */
export function analyzePortfoliosForPlan(
  portfolios: UserPortfolio[],
  plan: UserPlan,
  options?: { prefsTrusted?: boolean },
): PortfolioConsolidationResult {
  const prefsTrusted = options?.prefsTrusted ?? true;
  const normalized = ensureSinglePrimary(portfolios);

  if (
    !prefsTrusted ||
    plan === "premium" ||
    normalized.length <= 1
  ) {
    return {
      keep: normalized,
      surplusIds: [],
      suggestedKeeperId: null,
    };
  }

  const keeper = pickPortfolioToKeep(normalized);

  return {
    keep: normalized,
    surplusIds: normalized
      .filter((portfolio) => portfolio.id !== keeper.id)
      .map((portfolio) => portfolio.id),
    suggestedKeeperId: keeper.id,
  };
}

/**
 * @deprecated Destructive auto-prune has been removed. Use analyzePortfoliosForPlan.
 * Kept as a safe alias that never deletes.
 */
export function consolidatePortfoliosForPlan(
  portfolios: UserPortfolio[],
  plan: UserPlan,
  options?: { prefsTrusted?: boolean },
): {
  keep: UserPortfolio[];
  deleteIds: string[];
} {
  const result = analyzePortfoliosForPlan(portfolios, plan, options);
  return {
    keep: result.keep,
    // Never auto-delete — Free max-1 is enforced at create time.
    deleteIds: [],
  };
}
