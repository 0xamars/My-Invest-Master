/** Public-stock ticker only — letters, digits, dot, hyphen. */
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.-]{0,15}$/;

export function normalizeTickerSymbol(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const symbol = raw.trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return null;
  return symbol;
}

export function investTickerPath(symbol: string): string {
  return `/analysis/${encodeURIComponent(symbol.toUpperCase())}`;
}
