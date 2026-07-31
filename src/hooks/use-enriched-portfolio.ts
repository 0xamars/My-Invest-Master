"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useFxRate } from "@/hooks/use-fx-rate";
import { usePortfolioPrices } from "@/hooks/use-portfolio-prices";
import {
  enrichHoldings,
  getPortfolioTotals,
} from "@/lib/portfolio/calculations";
import { isHoldingVisible } from "@/lib/portfolio/transactions";
import {
  resolvePortfolioViewScope,
  type PortfolioViewScope,
} from "@/lib/portfolio/view-scope";
import type { UserPortfolio } from "@/types/portfolio";

export type EnrichedPortfolioSource = "auto" | "primary" | "active";

function pickScopedPortfolio(
  scope: PortfolioViewScope,
  primaryPortfolio: UserPortfolio | null,
  activePortfolio: UserPortfolio | null,
): UserPortfolio | null {
  if (scope === "active") {
    return activePortfolio ?? primaryPortfolio;
  }
  return primaryPortfolio ?? activePortfolio;
}

/**
 * Enriched holdings for summaries (Invest, AI, Analytics).
 *
 * Default `auto` scope:
 * - Primary portfolio outside `/portfolio/[id]`
 * - Active (currently viewing) portfolio on a detail page
 */
export function useEnrichedPortfolio(
  source: EnrichedPortfolioSource = "auto",
) {
  const pathname = usePathname();
  const {
    primaryPortfolio,
    activePortfolio,
    isLoaded: isStorageLoaded,
  } = usePortfolioPlans();
  const {
    currency,
    setCurrency,
    isLoaded: isCurrencyLoaded,
  } = useDisplayCurrency();
  const { rates, isLoading: isFxLoading, error: fxError } = useFxRate();

  const scope: PortfolioViewScope =
    source === "auto" ? resolvePortfolioViewScope(pathname) : source;

  const portfolio = pickScopedPortfolio(
    scope,
    primaryPortfolio,
    activePortfolio,
  );
  const holdings = portfolio?.holdings ?? [];

  const {
    prices,
    isLoading: isPricesLoading,
    isRefreshing,
    loadingSymbols,
    lastUpdated,
    error: pricesError,
    refetch,
  } = usePortfolioPrices(holdings);

  const visibleHoldings = useMemo(
    () => holdings.filter(isHoldingVisible),
    [holdings],
  );

  const enrichedHoldings = useMemo(
    () => enrichHoldings(visibleHoldings, prices, loadingSymbols, rates),
    [visibleHoldings, prices, loadingSymbols, rates],
  );

  const totals = useMemo(
    () => getPortfolioTotals(enrichedHoldings),
    [enrichedHoldings],
  );

  const isLoaded = isStorageLoaded && isCurrencyLoaded;
  const isLoading = isPricesLoading || isFxLoading;

  return {
    holdings,
    enrichedHoldings,
    totals,
    currency,
    setCurrency,
    rates,
    isLoaded,
    isLoading,
    isRefreshing,
    lastUpdated,
    error: pricesError ?? fxError,
    fxError,
    refetch,
    portfolio,
    portfolioId: portfolio?.id ?? null,
    portfolioName: portfolio?.name ?? null,
    scope,
    isViewingPrimary: Boolean(portfolio?.isPrimary),
  };
}
