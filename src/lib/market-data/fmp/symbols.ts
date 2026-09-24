import { toQuoteSymbol } from "@/lib/market/csv";

export { toQuoteSymbol };

/**
 * Tickers that already end in USD but are not FMP pairs.
 * FMP quotes these as PYUSDUSD, TUSDUSD, and so on.
 */
const STABLECOIN_TICKERS = new Set([
  "PYUSD",
  "TUSD",
  "FDUSD",
  "BUSD",
  "GUSD",
  "USDD",
  "USDP",
  "USD1",
]);

/**
 * A compact symbol is already an FMP pair when it ends in USD and is not
 * one of the stablecoin tickers above. BTCUSD and PYUSDUSD stay as-is so a
 * second resolve does not append USD again.
 */
function isExistingFmpCryptoPair(compact: string): boolean {
  return (
    compact.endsWith("USD") &&
    compact.length > 3 &&
    !STABLECOIN_TICKERS.has(compact)
  );
}

/**
 * FMP crypto pairs are concatenated USD symbols (BTCUSD), not BTC-USD.
 * Append USD unless the input is already a pair or contains a separator
 * (BTC-USD, BTC/USD). Stablecoin tickers such as PYUSD become PYUSDUSD.
 */
export function toFmpCryptoSymbol(symbol: string): string {
  const raw = symbol.trim().toUpperCase();
  if (!raw) return "";
  const hasSeparator = /[^A-Z0-9]/.test(raw);
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";

  if (hasSeparator) {
    if (compact.endsWith("USDT") && compact.length > 4) {
      return compact.slice(0, -1);
    }
    if (compact.endsWith("USD")) return compact;
    return `${compact}USD`;
  }

  if (isExistingFmpCryptoPair(compact)) return compact;
  if (compact.endsWith("USDT") && compact.length > 4) {
    return compact.slice(0, -1);
  }
  return `${compact}USD`;
}

/** Same cleaning the Analysis Package uses for equity warehouse keys. */
export function toEquityHistorySymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}
