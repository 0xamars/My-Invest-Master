"use client";

import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";

/**
 * Active portfolio holdings + mutations (Portfolio detail editing).
 * For Invest / AI / Analytics summaries, use useEnrichedPortfolio() instead.
 */
export function usePortfolioStorage() {
  const {
    holdings,
    addTransaction,
    updateHolding,
    removeHolding,
    isLoaded,
    syncError,
    isCloudSynced,
    hasLegacyPortfolioBackup,
    reloadFromCloud,
    importLegacyPortfolio,
    activePortfolio,
    activePortfolioId,
    primaryPortfolio,
    portfolios,
  } = usePortfolioPlans();

  return {
    holdings,
    addTransaction,
    updateHolding,
    removeHolding,
    isLoaded,
    syncError,
    isCloudSynced,
    hasLegacyPortfolioBackup,
    reloadFromCloud,
    importLegacyPortfolio,
    activePortfolio,
    activePortfolioId,
    primaryPortfolio,
    portfolios,
  };
}
