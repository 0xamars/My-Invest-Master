import type { HeatmapStock } from "@/types/market";
import type { IndexConstituent } from "@/lib/market/index-config";

/**
 * Alternate share classes excluded from the heatmap in favor of a canonical ticker.
 * Indices may list both classes for some issuers (e.g. GOOG + GOOGL).
 */
const EXCLUDED_SHARE_CLASS_SYMBOLS = new Set([
  "GOOG",
  "FOX",
  "NWS",
]);

function normalizeCompanyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(class\s+[a-z0-9]+\)\s*/gi, " ")
    .replace(/\s*class\s+[a-z0-9]+(\s+common\s+stock)?/gi, " ")
    .replace(/\s+(inc\.?|corp\.?|corporation|company|co\.?|l\.?p\.?|plc|holdings?)\.?$/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function isExcludedHeatmapSymbol(symbol: string): boolean {
  return EXCLUDED_SHARE_CLASS_SYMBOLS.has(symbol.trim().toUpperCase());
}

export function filterHeatmapConstituents(
  constituents: IndexConstituent[],
): IndexConstituent[] {
  return constituents.filter(
    (constituent) => !isExcludedHeatmapSymbol(constituent.symbol),
  );
}

/** Safety net: drop alternate share classes and collapse same-company duplicates. */
export function dedupeHeatmapStocks(stocks: HeatmapStock[]): HeatmapStock[] {
  const byCompany = new Map<string, HeatmapStock>();

  for (const stock of stocks) {
    if (isExcludedHeatmapSymbol(stock.symbol)) continue;

    const key = normalizeCompanyKey(stock.name) || stock.symbol;
    const existing = byCompany.get(key);

    if (!existing || stock.marketCap > existing.marketCap) {
      byCompany.set(key, stock);
    }
  }

  return [...byCompany.values()];
}

export function getTopMovers(stocks: HeatmapStock[], count = 5): {
  gainers: HeatmapStock[];
  losers: HeatmapStock[];
} {
  const sorted = [...stocks].sort((a, b) => b.changePercent - a.changePercent);

  return {
    gainers: sorted.slice(0, count),
    losers: sorted.slice(-count).reverse(),
  };
}
