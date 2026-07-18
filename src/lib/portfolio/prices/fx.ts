import type { DisplayCurrency, FxRates } from "@/types/currency";
import { DEFAULT_FX_RATES } from "@/types/currency";

const FRANKFURTER_BASE = "https://api.frankfurter.app";

export async function fetchFxRates(): Promise<FxRates> {
  const response = await fetch(
    `${FRANKFURTER_BASE}/latest?from=USD&to=CAD,INR`,
    {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch FX rates");
  }

  const data = (await response.json()) as {
    rates?: { CAD?: number; INR?: number };
  };

  const cad = data.rates?.CAD;
  const inr = data.rates?.INR;

  if (
    typeof cad !== "number" ||
    cad <= 0 ||
    typeof inr !== "number" ||
    inr <= 0
  ) {
    throw new Error("Invalid FX rates");
  }

  return {
    USD: 1,
    CAD: cad,
    INR: inr,
    fetchedAt: new Date().toISOString(),
  };
}

export function convertFromUsd(
  amount: number,
  currency: DisplayCurrency,
  rates: FxRates = DEFAULT_FX_RATES,
): number {
  if (currency === "USD") return amount;
  return amount * rates[currency];
}

export function convertToUsd(
  amount: number,
  currency: DisplayCurrency,
  rates: FxRates = DEFAULT_FX_RATES,
): number {
  if (currency === "USD") return amount;
  return amount / rates[currency];
}

export function getFxRateLabel(
  currency: DisplayCurrency,
  rates: FxRates,
): string | null {
  if (currency === "USD") return null;
  return `1 USD = ${rates[currency].toFixed(currency === "INR" ? 2 : 4)} ${currency}`;
}
