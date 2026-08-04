/** Market-data provider configuration (server-side only). */

export function getFmpApiKey(): string | null {
  const key = process.env.FMP_API_KEY?.trim();
  return key || null;
}

export function isFmpConfigured(): boolean {
  return Boolean(getFmpApiKey());
}

/**
 * FMP stable API base (no trailing slash).
 * Legacy `/api/v3` paths are deprecated for new keys — use stable by default.
 */
export const FMP_API_BASE =
  process.env.FMP_API_BASE?.trim() ||
  "https://financialmodelingprep.com/stable";

/**
 * Yahoo secondary fallback after FMP / warehouse is tried first.
 * Default: disabled for equities fundamentals (FMP warehouse is primary).
 * Set MARKET_DATA_YAHOO_FALLBACK=1 to enable last-resort Yahoo fill.
 */
export function allowYahooFallback(): boolean {
  return process.env.MARKET_DATA_YAHOO_FALLBACK === "1";
}
