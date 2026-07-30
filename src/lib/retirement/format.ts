import type { DisplayCurrency, FxRates } from "@/types/currency";
import { DEFAULT_FX_RATES } from "@/types/currency";
import { convertFromUsd } from "@/lib/portfolio/prices/fx";

function currencyLocale(currency: DisplayCurrency): string {
  if (currency === "CAD") return "en-CA";
  if (currency === "INR") return "en-IN";
  return "en-US";
}

/** Whole-dollar projection values for tables and chart tooltips. */
export function formatProjectionMoney(
  usdValue: number,
  currency: DisplayCurrency,
  rates: FxRates = DEFAULT_FX_RATES,
): string {
  const rounded = Math.round(convertFromUsd(usdValue, currency, rates));

  return new Intl.NumberFormat(currencyLocale(currency), {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
}

/** Lifestyle spending shown as a negative outflow (e.g. -$100,000). */
export function formatProjectionSpending(
  usdValue: number,
  currency: DisplayCurrency,
  rates: FxRates = DEFAULT_FX_RATES,
): string {
  if (usdValue <= 0) {
    return formatProjectionMoney(0, currency, rates);
  }

  return formatProjectionMoney(-usdValue, currency, rates);
}

/** Compact whole-number axis labels for projection charts. */
export function formatProjectionCompactMoney(
  usdValue: number,
  currency: DisplayCurrency = "USD",
  rates: FxRates = DEFAULT_FX_RATES,
): string {
  const value = Math.round(convertFromUsd(usdValue, currency, rates));
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  const prefix =
    currency === "INR" ? "₹" : currency === "CAD" ? "CA$" : "$";

  if (abs >= 1_000_000_000_000) {
    return `${sign}${prefix}${Math.round(abs / 1_000_000_000_000)}T`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}${prefix}${Math.round(abs / 1_000_000_000)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${Math.round(abs / 1_000_000)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${Math.round(abs / 1_000)}K`;
  }

  return formatProjectionMoney(usdValue, currency, rates);
}
