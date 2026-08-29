/**
 * Research leftovers and former top-level Invest tools fold into a pillar.
 * `permanent: false` is a 307 in next.config — never 404.
 */
export const INVEST_LEGACY_REDIRECTS = [
  { source: "/analytics", destination: "/invest", permanent: false },
  { source: "/performance", destination: "/invest", permanent: false },
  { source: "/markets", destination: "/invest", permanent: false },
  { source: "/market", destination: "/invest", permanent: false },
  { source: "/holdings", destination: "/invest/portfolio", permanent: true },
  { source: "/analysis", destination: "/invest", permanent: false },
  { source: "/signin", destination: "/login", permanent: false },
  { source: "/pricing", destination: "/", permanent: false },
  { source: "/portfolio", destination: "/invest/portfolio", permanent: false },
  {
    source: "/portfolio/:id",
    destination: "/invest/portfolio/:id",
    permanent: false,
  },
  { source: "/watchlist", destination: "/invest/watchlist", permanent: false },
  {
    source: "/watchlist/:id",
    destination: "/invest/watchlist/:id",
    permanent: false,
  },
  { source: "/options", destination: "/invest/options", permanent: false },
  { source: "/chat", destination: "/invest", permanent: false },
  { source: "/chat/:path*", destination: "/invest", permanent: false },
  { source: "/assistant", destination: "/invest", permanent: false },
  { source: "/assistant/:path*", destination: "/invest", permanent: false },
  { source: "/retire", destination: "/freedom", permanent: false },
  { source: "/retire/plans", destination: "/freedom/plans", permanent: false },
  {
    source: "/retire/plans/:id",
    destination: "/freedom/plans/:id",
    permanent: false,
  },
] as const;

export function destinationForLegacyInvestPath(
  pathname: string,
): string | null {
  if (pathname === "/analysis") {
    return "/invest";
  }
  if (pathname === "/market" || pathname === "/markets") {
    return "/invest";
  }
  if (pathname === "/analytics" || pathname === "/performance") {
    return "/invest";
  }
  if (pathname === "/pricing") {
    return "/";
  }
  if (pathname === "/signin") {
    return "/login";
  }
  if (pathname === "/holdings") {
    return "/invest/portfolio";
  }
  if (pathname === "/portfolio") {
    return "/invest/portfolio";
  }
  if (pathname.startsWith("/portfolio/")) {
    return `/invest${pathname}`;
  }
  if (pathname === "/watchlist") {
    return "/invest/watchlist";
  }
  if (pathname.startsWith("/watchlist/")) {
    return `/invest${pathname}`;
  }
  if (pathname === "/options" || pathname.startsWith("/options/")) {
    return "/invest/options";
  }
  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return "/invest";
  }
  if (pathname === "/assistant" || pathname.startsWith("/assistant/")) {
    return "/invest";
  }
  if (pathname === "/retire") {
    return "/freedom";
  }
  if (pathname.startsWith("/retire/")) {
    return `/freedom${pathname.slice("/retire".length)}`;
  }
  return null;
}
