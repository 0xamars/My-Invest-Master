/**
 * Orphan dashboards that repeat the book or checkup. Keep `/market` working;
 * `/markets` was a leftover stub.
 */
export const INVEST_LEGACY_REDIRECTS = [
  { source: "/analytics", destination: "/invest", permanent: false },
  { source: "/performance", destination: "/invest", permanent: false },
  { source: "/markets", destination: "/market", permanent: false },
  { source: "/holdings", destination: "/portfolio", permanent: true },
  { source: "/analysis", destination: "/invest", permanent: false },
  { source: "/signin", destination: "/login", permanent: false },
  { source: "/pricing", destination: "/", permanent: false },
] as const;

export function destinationForLegacyInvestPath(
  pathname: string,
): string | null {
  const match = INVEST_LEGACY_REDIRECTS.find(
    (entry) => entry.source === pathname,
  );
  return match?.destination ?? null;
}
