/**
 * Research and leftover dashboards fold into Invest or the book.
 * `permanent: false` is a 307 in next.config — never 404.
 */
export const INVEST_LEGACY_REDIRECTS = [
  { source: "/analytics", destination: "/invest", permanent: false },
  { source: "/performance", destination: "/invest", permanent: false },
  { source: "/markets", destination: "/invest", permanent: false },
  { source: "/market", destination: "/invest", permanent: false },
  { source: "/holdings", destination: "/portfolio", permanent: true },
  { source: "/analysis", destination: "/invest", permanent: false },
  { source: "/analysis/:symbol", destination: "/invest", permanent: false },
  { source: "/signin", destination: "/login", permanent: false },
  { source: "/pricing", destination: "/", permanent: false },
] as const;

export function destinationForLegacyInvestPath(
  pathname: string,
): string | null {
  if (pathname === "/analysis" || pathname.startsWith("/analysis/")) {
    return "/invest";
  }
  if (pathname === "/market" || pathname === "/markets") {
    return "/invest";
  }
  const match = INVEST_LEGACY_REDIRECTS.find(
    (entry) => entry.source === pathname,
  );
  return match?.destination ?? null;
}
