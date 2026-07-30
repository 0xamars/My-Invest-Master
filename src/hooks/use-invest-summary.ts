"use client";

import { useMemo } from "react";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useEnrichedPortfolio } from "@/hooks/use-enriched-portfolio";
import { useFxRate } from "@/hooks/use-fx-rate";
import { useOptionsPrices } from "@/hooks/use-options-prices";
import { useOptionsStorage } from "@/hooks/use-options-storage";
import {
  enrichOptionsPositions,
  finalizeOptionsSummary,
  getOptionsSummary,
} from "@/lib/portfolio/options-calculations";

export function useInvestSummary() {
  const portfolio = useEnrichedPortfolio();
  const { positions, isLoaded: isOptionsStorageLoaded } = useOptionsStorage();
  const { rates } = useFxRate();
  const {
    prices: optionPrices,
    isLoading: isOptionsPricesLoading,
    loadingSymbols: optionsLoadingSymbols,
  } = useOptionsPrices(positions);

  const enrichedPositions = useMemo(
    () => enrichOptionsPositions(positions, optionPrices, optionsLoadingSymbols),
    [positions, optionPrices, optionsLoadingSymbols],
  );

  const optionsSummary = useMemo(
    () => finalizeOptionsSummary(getOptionsSummary(enrichedPositions)),
    [enrichedPositions],
  );

  const activeOptionsCount = useMemo(
    () =>
      enrichedPositions.filter((position) => position.displayStatus === "active")
        .length,
    [enrichedPositions],
  );

  const isLoaded = portfolio.isLoaded && isOptionsStorageLoaded;
  const isLoading = portfolio.isLoading || isOptionsPricesLoading;

  return {
    portfolio,
    optionsSummary,
    activeOptionsCount,
    optionsCount: positions.length,
    enrichedPositions,
    rates,
    currency: portfolio.currency,
    isLoaded,
    isLoading,
  };
}
