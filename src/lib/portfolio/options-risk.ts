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