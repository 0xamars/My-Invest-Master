import type { DisplayCurrency, FxRates } from "@/types/currency";
import { DEFAULT_FX_RATES } from "@/types/currency";
import type { AssetType } from "@/types/portfolio";
import {
  convertFromUsd,
  convertToUsd,
} from "@/lib/portfolio/prices/fx";

function currencyLocale(currency: DisplayCurrency): string {
  if (currency === "CAD") return "en-CA";
  if (currency === "INR") return "en-IN";
  return "en-US";
}

export function formatCurrency(
  value: number,
  currency: DisplayCurrency = "USD",
): string {
  return new Intl.NumberFormat(currencyLocale(currency), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDisplayMoney(
  usdValue: number,
  currency: DisplayCurrency,
  rates: FxRates = DEFAULT_FX_RATES,
): string {
  return formatCurrency(convertFromUsd(usdValue, currency, rates), currency);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatQuantity(value: number, type: AssetType): string {
  if (type === "cash") {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if ((type === "crypto" || type === "custom") && value < 1) {
    return value.toFixed(6);
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function formatPrice(
  usdValue: number,
  type: AssetType,
  currency: DisplayCurrency = "USD",
  rates: FxRates = DEFAULT_FX_RATES,
): string {
  const value = convertFromUsd(usdValue, currency, rates);

  if (type === "cash") {
    return formatCurrency(value, currency);
  }

  if ((type === "crypto" || type === "custom") && usdValue >= 1000) {
    return formatCurrency(value, currency);
  }

  if (type === "crypto" || type === "custom") {
    return new Intl.NumberFormat(currencyLocale(currency), {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: usdValue < 1 ? 6 : 2,
    }).format(value);
  }

  return formatCurrency(value, currency);
}

export function formatCashAmount(
  nativeAmount: number,
  cashCurrency: DisplayCurrency,
  displayCurrency: DisplayCurrency,
  rates: FxRates = DEFAULT_FX_RATES,
): string {
  const usdValue = convertToUsd(nativeAmount, cashCurrency, rates);
  return formatDisplayMoney(usdValue, displayCurrency, rates);
}

export function profitLossClass(value: number): string {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}
