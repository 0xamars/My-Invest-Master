/**
 * Signed-in app surfaces. Marketing, auth, and legal pages stay public.
 * Prefix match: `/freedom` also covers `/freedom/plans`.
 * `/retire` stays gated so the legacy redirect still requires a session.
 */
export const PROTECTED_ROUTE_PREFIXES = [
  "/home",
  "/money-profile",
  "/invest",
  "/freedom",
  "/retire",
  "/watchlist",
  "/analysis",
  "/settings",
  "/analytics",
  "/performance",
  "/markets",
  "/portfolio",
  "/options",
  "/holdings",
  "/budget",
  "/market",
] as const;

export const PUBLIC_MARKETING_PATHS = ["/"] as const;

export const PUBLIC_ROUTE_PATHS = [
  "/",
  "/pricing",
  "/signup",
  "/login",
  "/signin",
  "/terms",
  "/privacy",
] as const;

export const PUBLIC_ROUTE_PREFIXES = ["/auth"] as const;

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTE_PATHS.some((route) => pathname === route)) {
    return true;
  }
  return PUBLIC_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isProtectedRoute(pathname: string): boolean {
  if (isPublicRoute(pathname)) return false;
  return PROTECTED_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
