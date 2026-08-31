export const BUDGET_PATH = "/budget";
export const INVEST_PATH = "/invest";
/** User-facing pillar. Legacy `/retire` redirects here. */
export const FREEDOM_PATH = "/freedom";
export const RETIRE_PATH = FREEDOM_PATH;
export const RETIRE_LEGACY_PATH = "/retire";
export const SETTINGS_PATH = "/settings";
export const JOURNEY_HOME_PATH = "/home";
export const MONEY_PROFILE_PATH = "/money-profile";

/** Invest children live under the Invest pillar — never as peer products. */
export const INVEST_PORTFOLIO_PATH = "/invest/portfolio";
export const INVEST_WATCHLIST_PATH = "/invest/watchlist";
export const INVEST_OPTIONS_PATH = "/invest/options";

/** Signed-in primary chrome — three products. Home is not a pillar. Settings is the account menu. */
export const SIGNED_IN_PRIMARY_NAV = [
  { title: "Budget", href: BUDGET_PATH, category: "budget" as const },
  { title: "Invest", href: INVEST_PATH, category: "invest" as const },
  { title: "Freedom", href: FREEDOM_PATH, category: "retire" as const },
] as const;

/** Invest children — submenu or in-page cards, never top-level peers. */
export const INVEST_ASSESS_PATH = "/invest/assess";

export const INVEST_CHILD_NAV = [
  { title: "Assess", href: INVEST_ASSESS_PATH },
  { title: "Portfolio", href: INVEST_PORTFOLIO_PATH },
  { title: "Watchlist", href: INVEST_WATCHLIST_PATH },
  { title: "Options", href: INVEST_OPTIONS_PATH },
] as const;

export const SIGNED_IN_FOOTER_NAV = [
  { title: "Settings", href: SETTINGS_PATH },
] as const;

export const PRIMARY_NAV_TITLES = SIGNED_IN_PRIMARY_NAV.map((item) => item.title);

export type ProductPillar = "budget" | "invest" | "retire";

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

export { investTickerPath } from "@/lib/ticker/symbol";

export function investAssessPath(id?: string): string {
  if (!id?.trim()) return INVEST_ASSESS_PATH;
  return `${INVEST_ASSESS_PATH}/${encodeURIComponent(id.toUpperCase())}`;
}

export function retirePlansPath(id?: string): string {
  return id ? `${RETIRE_PATH}/plans/${id}` : `${RETIRE_PATH}/plans`;
}

export function isHomePath(pathname: string): boolean {
  return pathname === "/home" || pathname === "/";
}

export function isJourneyHomePath(pathname: string): boolean {
  return pathname === JOURNEY_HOME_PATH;
}

export function isMoneyProfilePath(pathname: string): boolean {
  return (
    pathname === MONEY_PROFILE_PATH ||
    pathname.startsWith(`${MONEY_PROFILE_PATH}/`)
  );
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
  return JOURNEY_HOME_PATH;
}

export function pillarLabel(pathname: string): string {
  const pillar = pillarForPath(pathname);
  if (pillar === "budget") return "Budget";
  if (pillar === "invest") return "Invest";
  if (pillar === "retire") return "Freedom";
  return "Journey";
}

/** True on product hubs and Journey landing — no up-link. */
export function isPillarHub(pathname: string): boolean {
  return (
    pathname === BUDGET_PATH ||
    pathname === INVEST_PATH ||
    pathname === FREEDOM_PATH ||
    pathname === RETIRE_LEGACY_PATH ||
    pathname === JOURNEY_HOME_PATH ||
    pathname === MONEY_PROFILE_PATH
  );
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

  if (pathname.startsWith("/analysis/")) {
    const symbol = decodeURIComponent(pathname.slice("/analysis/".length)).split("/")[0];
    return symbol ? symbol.toUpperCase() : "Ticker";
  }

  if (pathname === INVEST_ASSESS_PATH) {
    return "Assess";
  }
  if (pathname.startsWith(`${INVEST_ASSESS_PATH}/`)) {
    const symbol = decodeURIComponent(
      pathname.slice(`${INVEST_ASSESS_PATH}/`.length),
    ).split("/")[0];
    return symbol ? `${symbol.toUpperCase()} · Assess` : "Assess";
  }

  const pageTitles: Record<string, string> = {
    "/": "InvestSalsa",
    "/home": "Journey",
    "/money-profile": "Money Profile",
    "/invest": "Invest",
    "/invest/assess": "Assess",
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
