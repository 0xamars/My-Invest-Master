import { APP_HOME_PATH } from "@/lib/routes";

export const BUDGET_PATH = "/budget";
export const INVEST_PATH = "/invest";
/** User-facing pillar. Legacy `/retire` redirects here. */
export const FREEDOM_PATH = "/freedom";
export const RETIRE_PATH = FREEDOM_PATH;
export const RETIRE_LEGACY_PATH = "/retire";
export const SETTINGS_PATH = "/settings";

/** Invest children live under the Invest pillar — never as peer products. */
export const INVEST_PORTFOLIO_PATH = "/invest/portfolio";
export const INVEST_WATCHLIST_PATH = "/invest/watchlist";
export const INVEST_OPTIONS_PATH = "/invest/options";

/** Signed-in primary chrome — four products only. Settings is the account menu. */
export const SIGNED_IN_PRIMARY_NAV = [
  { title: "Home", href: APP_HOME_PATH, category: "home" as const },
  { title: "Budget", href: BUDGET_PATH, category: "budget" as const },
  { title: "Invest", href: INVEST_PATH, category: "invest" as const },
  { title: "Freedom", href: FREEDOM_PATH, category: "retire" as const },
] as const;

/** Invest children — submenu or in-page cards, never top-level peers. */
export const INVEST_CHILD_NAV = [
  { title: "Portfolio", href: INVEST_PORTFOLIO_PATH },
  { title: "Watchlist", href: INVEST_WATCHLIST_PATH },
  { title: "Options", href: INVEST_OPTIONS_PATH },
] as const;

export const SIGNED_IN_FOOTER_NAV = [
  { title: "Settings", href: SETTINGS_PATH },
] as const;

export const PRIMARY_NAV_TITLES = SIGNED_IN_PRIMARY_NAV.map((item) => item.title);

export type ProductPillar = "home" | "budget" | "invest" | "retire";

export function budgetPlanPath(
  id: string,
  child?: "transactions" | "reports" | "accounts",
): string {
  const base = `${BUDGET_PATH}/plans/${id}`;
  return child ? `${base}/${child}` : base;
}

export function investPortfolioPath(id?: string): string {
  return id ? `${INVEST_PORTFOLIO_PATH}/${id}` : INVEST_PORTFOLIO_PATH;
}

export function investWatchlistPath(id?: string): string {
  return id ? `${INVEST_WATCHLIST_PATH}/${id}` : INVEST_WATCHLIST_PATH;
}

export function retirePlansPath(id?: string): string {
  return id ? `${RETIRE_PATH}/plans/${id}` : `${RETIRE_PATH}/plans`;
}

export function isHomePath(pathname: string): boolean {
  return pathname === APP_HOME_PATH;
}

export function isBudgetPath(pathname: string): boolean {
  return pathname === BUDGET_PATH || pathname.startsWith(`${BUDGET_PATH}/`);
}

export function isInvestPath(pathname: string): boolean {
  return (
    pathname === INVEST_PATH ||
    pathname.startsWith(`${INVEST_PATH}/`) ||
    pathname.startsWith("/watchlist") ||
    pathname.startsWith("/portfolio") ||
    pathname.startsWith("/options") ||
    pathname.startsWith("/analysis") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/market") ||
    pathname.startsWith("/holdings") ||
    pathname.startsWith("/performance")
  );
}

export function isRetirePath(pathname: string): boolean {
  return (
    pathname === FREEDOM_PATH ||
    pathname.startsWith(`${FREEDOM_PATH}/`) ||
    pathname === RETIRE_LEGACY_PATH ||
    pathname.startsWith(`${RETIRE_LEGACY_PATH}/`)
  );
}

export function isSettingsPath(pathname: string): boolean {
  return pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`);
}

export function isNavItemActive(
  pathname: string,
  href: string,
  options?: { exact?: boolean },
): boolean {
  if (options?.exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function pillarForPath(pathname: string): ProductPillar | null {
  if (isHomePath(pathname)) return "home";
  if (isBudgetPath(pathname)) return "budget";
  if (isInvestPath(pathname)) return "invest";
  if (isRetirePath(pathname)) return "retire";
  return null;
}

/** Up-link from a nested screen — the pillar hub, not marketing `/`. */
export function pillarHomePath(pathname: string): string {
  const pillar = pillarForPath(pathname);
  if (pillar === "budget") return BUDGET_PATH;
  if (pillar === "invest") return INVEST_PATH;
  if (pillar === "retire") return RETIRE_PATH;
  return APP_HOME_PATH;
}

export function resolvePageTitle(
  pathname: string,
  planName?: string | null,
): string {
  if (pathname === `${FREEDOM_PATH}/plans` || pathname === `${RETIRE_LEGACY_PATH}/plans`) {
    return "Freedom plans";
  }
  if (
    pathname.startsWith(`${FREEDOM_PATH}/plans/`) ||
    pathname.startsWith(`${RETIRE_LEGACY_PATH}/plans/`)
  ) {
    return planName ?? "Freedom plan";
  }
  if (pathname.startsWith(FREEDOM_PATH) || pathname.startsWith(RETIRE_LEGACY_PATH)) {
    return "Freedom";
  }

  if (pathname === "/budget") return "Budget";
  if (pathname.startsWith("/budget/plans/")) {
    if (pathname.endsWith("/transactions")) {
      return planName ? `${planName} · Transactions` : "Transactions";
    }
    if (pathname.endsWith("/reports")) {
      return planName ? `${planName} · Reports` : "Reports";
    }
    if (pathname.endsWith("/accounts")) {
      return planName ? `${planName} · Accounts` : "Accounts";
    }
    return planName ?? "Budget plan";
  }

  if (
    pathname === INVEST_PORTFOLIO_PATH ||
    pathname === "/portfolio"
  ) {
    return "Portfolios";
  }
  if (
    pathname.startsWith(`${INVEST_PORTFOLIO_PATH}/`) ||
    pathname.startsWith("/portfolio/")
  ) {
    return planName ?? "Portfolio";
  }

  if (
    pathname === INVEST_WATCHLIST_PATH ||
    pathname === "/watchlist"
  ) {
    return "Watchlists";
  }
  if (
    pathname.startsWith(`${INVEST_WATCHLIST_PATH}/`) ||
    pathname.startsWith("/watchlist/")
  ) {
    return planName ?? "Watchlist";
  }

  const pageTitles: Record<string, string> = {
    "/": "Home",
    "/home": "Home",
    "/invest": "Invest",
    "/invest/options": "Options",
    "/options": "Options",
    "/settings": "Settings",
    "/terms": "Terms",
    "/privacy": "Privacy",
    "/login": "Sign in",
    "/signup": "Create account",
  };

  return pageTitles[pathname] ?? "InvestSalsa";
}
