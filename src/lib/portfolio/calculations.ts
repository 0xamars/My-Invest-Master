import type { FxRates } from "@/types/currency";
import { DEFAULT_FX_RATES } from "@/types/currency";
import type {
  PortfolioHolding,
  PortfolioHoldingWithPrices,
} from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";
import { convertToUsd } from "@/lib/portfolio/prices/fx";

function resolveCurrentPrice(
  holding: PortfolioHolding,
  prices: Record<string, number>,
  rates: FxRates,
): number | null {
  if (holding.type === "cash") {
    return convertToUsd(1, getCashCurrency(holding), rates);
  }
  if (holding.type === "custom") {
    return holding.manualCurrentPrice ?? null;
  }
  return prices[holding.symbol] ?? null;
}

function resolveCashUsdValue(
  holding: PortfolioHolding,
  rates: FxRates,
): number {
  return convertToUsd(holding.quantity, getCashCurrency(holding), rates);
}

export function enrichHoldings(
  holdings: PortfolioHolding[],
  prices: Record<string, number>,
  loadingSymbols: Set<string> = new Set(),
  rates: FxRates = DEFAULT_FX_RATES,
): PortfolioHoldingWithPrices[] {
  const enriched = holdings.map((holding) => {
    const isLiveAsset = holding.type === "stock" || holding.type === "crypto";
    const isPriceLoading = isLiveAsset && loadingSymbols.has(holding.symbol);

    if (holding.type === "cash") {
      const usdValue = resolveCashUsdValue(holding, rates);
      return {
        ...holding,
        currentPrice: convertToUsd(1, getCashCurrency(holding), rates),
        costValue: usdValue,
        currentValue: usdValue,
        profitLoss: 0,
        profitLossPercent: 0,
        portfolioPercent: 0,
        isPriceLoading: false,
      };
    }

    const costValue = holding.costPrice * holding.quantity;
    const currentPrice = resolveCurrentPrice(holding, prices, rates);

    if (currentPrice === null) {
      return {
        ...holding,
        currentPrice: null,
        costValue,
        currentValue: null,
        profitLoss: null,
        profitLossPercent: null,
        portfolioPercent: null,
        isPriceLoading,
      };
    }

    const currentValue = currentPrice * holding.quantity;
    const profitLoss = currentValue - costValue;
    const profitLossPercent =
      costValue === 0 ? 0 : (profitLoss / costValue) * 100;

    return {
      ...holding,
      currentPrice,
      costValue,
      currentValue,
      profitLoss,
      profitLossPercent,
      portfolioPercent: 0,
      isPriceLoading: false,
    };
  });

  const totalCurrentValue = enriched.reduce(
    (sum, h) => sum + (h.currentValue ?? 0),
    0,
  );

  return enriched.map((holding) => ({
    ...holding,
    portfolioPercent:
      holding.currentValue === null || totalCurrentValue === 0
        ? null
        : (holding.currentValue / totalCurrentValue) * 100,
  }));
}

export function getPortfolioTotals(holdings: PortfolioHoldingWithPrices[]) {
  return holdings.reduce(
    (acc, h) => ({
      costValue: acc.costValue + h.costValue,
      currentValue: acc.currentValue + (h.currentValue ?? 0),
      profitLoss: acc.profitLoss + (h.profitLoss ?? 0),
      hasLoadingPrices:
        acc.hasLoadingPrices || h.isPriceLoading || h.currentPrice === null,
    }),
    {
      costValue: 0,
      currentValue: 0,
      profitLoss: 0,
      hasLoadingPrices: false,
    },
  );
}
