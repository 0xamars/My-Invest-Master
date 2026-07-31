import type { AnalysisQuote, AnalysisQuoteStat } from "@/lib/analysis/types";
import { formatCompactMoney, formatPrice } from "@/lib/portfolio/format";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import { DEFAULT_FX_RATES } from "@/types/currency";

function formatCompactCount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

export function buildAnalysisQuoteStats(
  quote: AnalysisQuote,
  currency: DisplayCurrency = "USD",
  rates: FxRates = DEFAULT_FX_RATES,
): AnalysisQuoteStat[] {
  const stats: AnalysisQuoteStat[] = [];
  const assetType = quote.type === "crypto" ? "crypto" : "stock";

  if (quote.marketCap != null && quote.marketCap > 0) {
    stats.push({
      id: "marketCap",
      label: "Market cap",
      value: formatCompactMoney(quote.marketCap, currency, rates),
    });
  }

  if (quote.volume != null && quote.volume > 0) {
    stats.push({
      id: "volume",
      label: quote.type === "crypto" ? "24h volume" : "Volume",
      value:
        quote.type === "crypto"
          ? formatCompactMoney(quote.volume, currency, rates)
          : formatCompactCount(quote.volume),
    });
  }

  if (quote.averageVolume != null && quote.averageVolume > 0) {
    stats.push({
      id: "avgVolume",
      label: "Avg volume (3M)",
      value: formatCompactCount(quote.averageVolume),
    });
  }

  if (
    quote.dayLow != null &&
    quote.dayHigh != null &&
    quote.dayLow > 0 &&
    quote.dayHigh > 0
  ) {
    stats.push({
      id: "dayRange",
      label: "Day range",
      value: `${formatPrice(quote.dayLow, assetType, currency, rates)} – ${formatPrice(quote.dayHigh, assetType, currency, rates)}`,
    });
  }

  if (
    quote.week52Low != null &&
    quote.week52High != null &&
    quote.week52Low > 0 &&
    quote.week52High > 0
  ) {
    stats.push({
      id: "week52",
      label: "52-week range",
      value: `${formatPrice(quote.week52Low, assetType, currency, rates)} – ${formatPrice(quote.week52High, assetType, currency, rates)}`,
    });
  }

  return stats;
}
