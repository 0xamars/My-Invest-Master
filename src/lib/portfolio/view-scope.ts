/**
 * Primary = user's default portfolio for Invest / AI / Analytics.
 * Active = portfolio currently open on a Portfolio detail route.
 */

export function isPortfolioDetailPath(pathname: string): boolean {
  return /^\/portfolio\/[^/]+\/?$/.test(pathname);
}

export type PortfolioViewScope = "primary" | "active";

/** Outside portfolio detail → Primary; on /portfolio/[id] → Active (viewing). */
export function resolvePortfolioViewScope(
  pathname: string,
): PortfolioViewScope {
  return isPortfolioDetailPath(pathname) ? "active" : "primary";
}
