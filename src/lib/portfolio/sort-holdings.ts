import { convertToUsd } from "@/lib/portfolio/prices/fx";
import type { FxRates } from "@/types/currency";
import type { PortfolioHoldingWithPrices } from "@/types/portfolio";
import { getCashCurrency } from "@/types/portfolio";

export type SortColumn =
  | "ticker"
  | "category"
  | "subCategory"
  | "currentPrice"
  | "costPrice"
  | "quantity"
  | "costValue"
  | "currentValue"
  | "profitLoss"
  | "profitLossPercent"
  | "portfolioPercent";

export type SortDirection = "asc" | "desc";

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = {
  column: "currentValue",
  direction: "desc",
};

function compareNullableNumbers(
  a: number | null,
  b: number | null,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function getQuantitySortValue(
  holding: PortfolioHoldingWithPrices,
  rates: FxRates,
): number {
  if (holding.type === "cash") {
    return convertToUsd(holding.quantity, getCashCurrency(holding), rates);
  }
  return holding.quantity;
}

function compareHoldings(
  a: PortfolioHoldingWithPrices,
  b: PortfolioHoldingWithPrices,
  column: SortColumn,
  rates: FxRates,
): number {
  switch (column) {
    case "ticker":
      return compareStrings(a.symbol, b.symbol);
    case "category":
      return compareStrings(a.category, b.category);
    case "subCategory":
      return compareStrings(a.subCategory, b.subCategory);
    case "currentPrice":
      return compareNullableNumbers(a.currentPrice, b.currentPrice);
    case "costPrice":
      return a.costPrice - b.costPrice;
    case "quantity":
      return getQuantitySortValue(a, rates) - getQuantitySortValue(b, rates);
    case "costValue":
      return a.costValue - b.costValue;
    case "currentValue":
      return compareNullableNumbers(a.currentValue, b.currentValue);
    case "profitLoss":
      return compareNullableNumbers(a.profitLoss, b.profitLoss);
    case "profitLossPercent":
      return compareNullableNumbers(a.profitLossPercent, b.profitLossPercent);
    case "portfolioPercent":
      return compareNullableNumbers(a.portfolioPercent, b.portfolioPercent);
    default:
      return 0;
  }
}

export function sortHoldings(
  holdings: PortfolioHoldingWithPrices[],
  sort: SortState,
  rates: FxRates,
): PortfolioHoldingWithPrices[] {
  return [...holdings].sort((a, b) => {
    const result = compareHoldings(a, b, sort.column, rates);
    return sort.direction === "asc" ? result : -result;
  });
}

export function getNextSortState(
  current: SortState,
  column: SortColumn,
): SortState {
  if (current.column === column) {
    return {
      column,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return { column, direction: "asc" };
}
