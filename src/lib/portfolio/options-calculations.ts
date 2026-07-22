import type {
  OptionStatus,
  OptionType,
  OptionsPosition,
  OptionsPositionWithMetrics,
} from "@/types/options";
import { getTodayDateString } from "@/lib/portfolio/transactions";

function parseDateOnly(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function computeDaysToExpiration(
  expiryDate: string,
  today = getTodayDateString(),
): number {
  const expiry = parseDateOnly(expiryDate);
  const now = parseDateOnly(today);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function resolveDisplayStatus(
  position: OptionsPosition,
  today = getTodayDateString(),
): OptionStatus {
  if (position.status === "closed" || position.status === "exercised") {
    return position.status;
  }
  if (position.expiryDate < today) {
    return "expired";
  }
  return "active";
}

export function computeIntrinsicValue(
  optionType: OptionType,
  stockPrice: number,
  strikePrice: number,
  contracts: number,
): number {
  const multiplier = contracts * 100;

  switch (optionType) {
    case "buy_call":
    case "sell_call":
      return Math.max(0, stockPrice - strikePrice) * multiplier;
    case "buy_put":
    case "sell_put":
      return Math.max(0, strikePrice - stockPrice) * multiplier;
  }
}

/** Unrealized P/L using intrinsic value vs premium paid/received. */
export function computeUnrealizedPl(
  position: OptionsPosition,
  stockPrice: number | null,
): number | null {
  if (stockPrice === null) return null;

  const intrinsic = computeIntrinsicValue(
    position.optionType,
    stockPrice,
    position.strikePrice,
    position.contracts,
  );
  const premium = position.cost;

  switch (position.optionType) {
    case "buy_call":
    case "buy_put":
      return intrinsic - premium;
    case "sell_call":
    case "sell_put":
      return premium - intrinsic;
  }
}

/** Whether stock move vs strike is favorable for this option type. */
export function isPriceChangeFavorable(
  optionType: OptionType,
  priceChangeFromStrike: number,
): boolean {
  switch (optionType) {
    case "buy_call":
    case "sell_put":
      return priceChangeFromStrike > 0;
    case "sell_call":
    case "buy_put":
      return priceChangeFromStrike < 0;
  }
}

export function enrichOptionsPositions(
  positions: OptionsPosition[],
  prices: Record<string, number>,
  loadingSymbols: Set<string> = new Set(),
  today = getTodayDateString(),
): OptionsPositionWithMetrics[] {
  return positions.map((position) => {
    const displayStatus = resolveDisplayStatus(position, today);
    const isPriceLoading = loadingSymbols.has(position.ticker);
    const currentStockPrice = prices[position.ticker] ?? null;
    const priceChange =
      currentStockPrice !== null
        ? currentStockPrice - position.strikePrice
        : null;

    const dte =
      displayStatus === "active"
        ? computeDaysToExpiration(position.expiryDate, today)
        : null;

    let unrealizedPl: number | null = null;
    if (displayStatus === "closed" || displayStatus === "exercised") {
      unrealizedPl =
        position.realizedPl ??
        computeUnrealizedPl(position, currentStockPrice);
    } else if (displayStatus === "expired") {
      unrealizedPl =
        currentStockPrice !== null
          ? computeUnrealizedPl(position, currentStockPrice)
          : position.optionType.startsWith("buy")
            ? -position.cost
            : position.cost;
    } else {
      unrealizedPl = computeUnrealizedPl(position, currentStockPrice);
    }

    return {
      ...position,
      displayStatus,
      currentStockPrice,
      priceChange,
      dte,
      unrealizedPl,
      isPriceLoading,
    };
  });
}

export interface OptionsSummary {
  totalPositions: number;
  activeCount: number;
  premiumPaid: number;
  premiumReceived: number;
  netPremium: number;
  unrealizedPl: number;
  hasLoadingPrices: boolean;
}

export function getOptionsSummary(
  positions: OptionsPositionWithMetrics[],
): OptionsSummary {
  return positions.reduce(
    (acc, position) => {
      const isReceived =
        position.optionType === "sell_call" ||
        position.optionType === "sell_put";

      if (isReceived) {
        acc.premiumReceived += position.cost;
      } else {
        acc.premiumPaid += position.cost;
      }

      if (position.displayStatus === "active") {
        acc.activeCount += 1;
      }

      acc.unrealizedPl += position.unrealizedPl ?? 0;
      acc.hasLoadingPrices =
        acc.hasLoadingPrices ||
        position.isPriceLoading ||
        (position.displayStatus === "active" &&
          position.currentStockPrice === null);

      return acc;
    },
    {
      totalPositions: positions.length,
      activeCount: 0,
      premiumPaid: 0,
      premiumReceived: 0,
      netPremium: 0,
      unrealizedPl: 0,
      hasLoadingPrices: false as boolean,
    },
  );
}

export function finalizeOptionsSummary(summary: OptionsSummary): OptionsSummary {
  return {
    ...summary,
    netPremium: summary.premiumReceived - summary.premiumPaid,
  };
}
