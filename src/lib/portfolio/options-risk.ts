/**
 * Options risk vs the primary book. Uses ledger fields only —
 * net premium and expiry dates. Does not invent greeks.
 */

export interface UpcomingExpiry {
  ticker: string;
  expiryDate: string;
  dte: number | null;
}

export function netPremiumPercentOfBook(
  netPremium: number,
  bookValue: number,
): number | null {
  if (!(bookValue > 0) || !Number.isFinite(netPremium)) return null;
  return (netPremium / bookValue) * 100;
}

/** Contract notional from strike × 100 × contracts. Does not invent greeks. */
export function optionStrikeNotional(position: {
  contracts: number;
  strikePrice: number;
}): number {
  return position.contracts * position.strikePrice * 100;
}

export function optionsNotionalVsBook(
  positions: { contracts: number; strikePrice: number; displayStatus: string }[],
  bookValue: number,
): { notional: number; percentOfBook: number | null } {
  const notional = positions
    .filter((position) => position.displayStatus === "active")
    .reduce((sum, position) => sum + optionStrikeNotional(position), 0);
  return {
    notional,
    percentOfBook:
      bookValue > 0 && Number.isFinite(notional)
        ? (notional / bookValue) * 100
        : null,
  };
}

export function expiringCallsWithinDays(
  positions: {
    ticker: string;
    optionType: string;
    expiryDate: string;
    displayStatus: string;
    dte: number | null;
    contracts: number;
    strikePrice: number;
    cost: number;
  }[],
  days = 14,
  today = new Date().toISOString().slice(0, 10),
) {
  return positions
    .filter((position) => {
      if (position.displayStatus !== "active") return false;
      if (!position.optionType.endsWith("_call")) return false;
      if (position.expiryDate < today) return false;
      if (position.dte == null || position.dte > days) return false;
      return position.dte >= 0;
    })
    .sort((a, b) => (a.dte ?? 0) - (b.dte ?? 0));
}

export function upcomingOptionExpiries(
  positions: {
    ticker: string;
    expiryDate: string;
    displayStatus: string;
    dte: number | null;
  }[],
  limit = 3,
  today = new Date().toISOString().slice(0, 10),
): UpcomingExpiry[] {
  return positions
    .filter(
      (position) =>
        position.displayStatus === "active" &&
        typeof position.expiryDate === "string" &&
        position.expiryDate.length >= 10 &&
        position.expiryDate >= today,
    )
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    .slice(0, limit)
    .map((position) => ({
      ticker: position.ticker,
      expiryDate: position.expiryDate,
      dte: position.dte,
    }));
}