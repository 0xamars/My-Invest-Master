import type { DisplayCurrency, FxRates } from "@/types/currency";
import {
  DEFAULT_FX_RATES,
  DISPLAY_CURRENCIES,
} from "@/types/currency";

const FRANKFURTER_BASE = "https://api.frankfurter.app";

const NON_USD_CURRENCIES = DISPLAY_CURRENCIES.filter(
  (code): code is Exclude<DisplayCurrency, "USD"> => code !== "USD",
);

function buildRatesFromPartial(
  partial: Partial<Record<string, number>>,
  fetchedAt: string,
): FxRates {
  const rates = {
    ...DEFAULT_FX_RATES,
    USD: 1 as const,
    fetchedAt,
  } satisfies FxRates;

  for (const code of NON_USD_CURRENCIES) {
    const value = partial[code];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      rates[code] = value;
    }
  }

  return rates;
}

export async function fetchFxRates(): Promise<FxRates> {
  const to = NON_USD_CURRENCIES.join(",");
  const response = await fetch(
    `${FRANKFURTER_BASE}/latest?from=USD&to=${to}`,
    {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch FX rates");
  }

  const data = (await response.json()) as {
    rates?: Record<string, number>;
    date?: string;
  };

  const live = data.rates ?? {};
  const liveCount = NON_USD_CURRENCIES.filter((code) => {
    const value = live[code];
    return typeof value === "number" && value > 0;
  }).length;

  if (liveCount === 0) {
    throw new Error("Invalid FX rates");
  }

  const fetchedAt = data.date
    ? new Date(`${data.date}T12:00:00.000Z`).toISOString()
    : new Date().toISOString();

  return buildRatesFromPartial(live, fetchedAt);
}

export function getFxRate(
  currency: DisplayCurrency,
  rates: FxRates = DEFAULT_FX_RATES,
): number {
  if (currency === "USD") return 1;
  const live = rates[currency];
  if (typeof live === "number" && live > 0) return live;
  const fallback = DEFAULT_FX_RATES[currency];
  if (typeof fallback === "number" && fallback > 0) return fallback;
  return 1;
}

/** True when a positive conversion rate exists (live or default fallback). */
export function canConvertCurrency(
  currency: DisplayCurrency,
  rates: FxRates = DEFAULT_FX_RATES,
): boolean {
  if (currency === "USD") return true;
  return getFxRate(currency, rates) > 0;
}

/**
 * True when the rate for this currency came from a live fetch rather than only
 * the static offline defaults (epoch fetchedAt).
 */
export function hasLiveFxRates(rates: FxRates): boolean {
  return rates.fetchedAt !== DEFAULT_FX_RATES.fetchedAt;
}

export function convertFromUsd(
  amount: number,
  currency: DisplayCurrency,
  rates: FxRates = DEFAULT_FX_RATES,
): number {
  if (currency === "USD") return amount;
  return amount * getFxRate(currency, rates);
}

export function convertToUsd(
  amount: number,
  currency: DisplayCurrency,
  rates: FxRates = DEFAULT_FX_RATES,
): number {
  if (currency === "USD") return amount;
  const rate = getFxRate(currency, rates);
  return rate > 0 ? amount / rate : amount;
}

export function getFxRateLabel(
  currency: DisplayCurrency,
  rates: FxRates,
): string | null {
  if (currency === "USD") return null;
  const rate = getFxRate(currency, rates);
  const decimals = rate >= 100 ? 2 : rate >= 10 ? 3 : 4;
  return `1 USD = ${rate.toFixed(decimals)} ${currency}`;
}
