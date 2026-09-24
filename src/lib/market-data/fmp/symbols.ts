import { toQuoteSymbol } from "@/lib/market/csv";

export { toQuoteSymbol };

/**
 * FMP crypto pairs are concatenated USD symbols (BTCUSD), not BTC-USD.
 * Idempotent for values that are already an FMP pair.
 */
export function toFmpCryptoSymbol(symbol: string): string {
  const compact = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";
  if (compact.endsWith("USD")) return compact;
  if (compact.endsWith("USDT") && compact.length > 4) {
    return `${compact.slice(0, -1)}`;
  }
  return `${compact}USD`;
}

/** Same cleaning the Analysis Package uses for equity warehouse keys. */
export function toEquityHistorySymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}
