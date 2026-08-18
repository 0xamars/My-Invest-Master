/**
 * Signed-in app surfaces. Marketing `/` and `/pricing` stay public.
 * Prefix match: `/retire` also covers `/retire/plans`.
 */
export const PROTECTED_ROUTE_PREFIXES = [
  "/home",
  "/invest",
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

export const PUBLIC_MARKETING_PATHS = ["/", "/pricing"] as const;

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
