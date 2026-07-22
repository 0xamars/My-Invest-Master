"use client";

import { useMemo } from "react";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useFxRate } from "@/hooks/use-fx-rate";
import { usePortfolioPrices } from "@/hooks/use-portfolio-prices";
import { usePortfolioStorage } from "@/hooks/use-portfolio-storage";
import {
  enrichHoldings,
  getPortfolioTotals,
} from "@/lib/portfolio/calculations";
import { isHoldingVisible } from "@/lib/portfolio/transactions";

export function useEnrichedPortfolio() {
  const { holdings, isLoaded: isStorageLoaded } = usePortfolioStorage();
  const {
    currency,
    setCurrency,
    isLoaded: isCurrencyLoaded,
  } = useDisplayCurrency();
  const { rates, isLoading: isFxLoading, error: fxError } = useFxRate();
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
    refetch,
  };
}
