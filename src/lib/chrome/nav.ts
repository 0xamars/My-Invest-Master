import { APP_HOME_PATH } from "@/lib/routes";

/** Signed-in primary chrome — four products only. Settings lives in the footer. */
export const SIGNED_IN_PRIMARY_NAV = [
  { title: "Home", href: APP_HOME_PATH, category: "home" as const },
  { title: "Budget", href: "/budget", category: "budget" as const },
  { title: "Invest", href: "/invest", category: "invest" as const },
  { title: "Retire", href: "/retire", category: "retire" as const },
] as const;

/** Invest children — submenu or in-page cards, never top-level peers. */
export const INVEST_CHILD_NAV = [
  { title: "Portfolio", href: "/portfolio" },
  { title: "Watchlist", href: "/watchlist" },
  { title: "Options", href: "/options" },
] as const;

export const SIGNED_IN_FOOTER_NAV = [
  { title: "Settings", href: "/settings" },
] as const;

export const PRIMARY_NAV_TITLES = SIGNED_IN_PRIMARY_NAV.map((item) => item.title);

export function isInvestPath(pathname: string): boolean {
  return (
    pathname === "/invest" ||
    pathname.startsWith("/watchlist") ||
    pathname.startsWith("/portfolio") ||
    pathname.startsWith("/options") ||
    pathname.startsWith("/analysis") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/market")
  );
}

export function isRetirePath(pathname: string): boolean {
  return pathname === "/retire" || pathname.startsWith("/retire/plans");
}
