import { toQuoteSymbol } from "@/lib/market/csv";

export { toQuoteSymbol };

/**
 * FMP pair symbols this app already emits. Base tickers stored on holdings
 * (BTC, PYUSD, RLUSD) are not in this set, so they still get USD appended.
 * A second resolve of one of these pairs stays on the pair.
 */
const KNOWN_FMP_PAIRS = new Set([
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "USDCUSD",
  "USDTUSD",
  "PYUSDUSD",
  "RLUSDUSD",
  "LUSDUSD",
  "SUSDUSD",
  "CUSDUSD",
  "AUSDUSD",
  "DUSDUSD",
  "TUSDUSD",
  "FDUSDUSD",
  "BUSDUSD",
  "GUSDUSD",
  "USDDUSD",
  "USDPUSD",
]);

/**
 * A resolved pair of a base that already ends in USD (PYUSD → PYUSDUSD).
 * Recognized so a second resolve does not append USD again.
 */
function isResolvedUsdBasePair(compact: string): boolean {
  return compact.endsWith("USDUSD") && compact.length > 6;
}

/**
 * FMP crypto pairs are concatenated USD symbols (BTCUSD), not BTC-USD.
 * Holdings store the base ticker, so append USD unless the input contains
 * `-` or `/`, or is a pair in `KNOWN_FMP_PAIRS`.
 */
export function toFmpCryptoSymbol(symbol: string): string {
  const raw = symbol.trim().toUpperCase();
  if (!raw) return "";
  const hasSeparator = /[-/]/.test(raw);
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";

  if (hasSeparator) {
    if (compact.endsWith("USDT") && compact.length > 4) {
      return compact.slice(0, -1);
    }
    if (compact.endsWith("USD")) return compact;
    return `${compact}USD`;
  }

  if (KNOWN_FMP_PAIRS.has(compact) || isResolvedUsdBasePair(compact)) {
    return compact;
  }
  if (compact.endsWith("USDT") && compact.length > 4) {
    return compact.slice(0, -1);
  }
  return `${compact}USD`;
}

/** Same cleaning the Analysis Package uses for equity warehouse keys. */
export function toEquityHistorySymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}
