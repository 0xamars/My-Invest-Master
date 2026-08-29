/**
 * Invest checkup: concentration, risk chip, allocation drift, auth routes.
 *   npx tsx --tsconfig tsconfig.json scripts/test-invest-unit.mts
 */
import { applyLeftoverToBookCash } from "../src/lib/invest/apply-leftover-to-cash.ts";
import {
  leftoverFromBudgetPlan,
  leftoverFromBudgetPlans,
  pickOpenablePlan,
} from "../src/lib/invest/leftover.ts";
import {
  INVEST_CHILD_NAV,
  PRIMARY_NAV_TITLES,
  SIGNED_IN_FOOTER_NAV,
  SIGNED_IN_PRIMARY_NAV,
  investPortfolioPath,
  isInvestPath,
  isPillarHub,
  pillarForPath,
  pillarHomePath,
  pillarLabel,
  resolvePageTitle,
} from "../src/lib/chrome/nav.ts";
import { destinationForLegacyInvestPath } from "../src/lib/invest/legacy-redirects.ts";
import {
  isPortfolioDetailPath,
  resolvePortfolioViewScope,
} from "../src/lib/portfolio/view-scope.ts";
import { ownedNameMovers } from "../src/lib/portfolio/book-movers.ts";
import {
  buildHoldingExpandFacts,
  classifyRevenuePath,
  holdingExpandHasRatingUi,
  holdingExpandShowsScreens,
  optionsOnUnderlying,
  pickNextEarningsDate,
  whyMovedFactLine,
} from "../src/lib/portfolio/holding-expand.ts";
import {
  buildAccountExportPayload,
  isAccountExportPayload,
} from "../src/lib/account/export.ts";
import { createEmptyBudgetPlan } from "../src/types/budget.ts";
import { safeAuthNextPath } from "../src/lib/routes.ts";
import { buildAllocationDrift } from "../src/lib/portfolio/allocation-targets.ts";
import {
  buildInvestmentCheckup,
  CASH_HEAVY_PCT,
  CONCENTRATION_FLAG_PCT,
  SLEEVE_DOMINANT_PCT,
  CONCENTRATION_NOTE_PCT,
  concentrationNoteForWeight,
  resolveRiskChip,
} from "../src/lib/portfolio/checkup.ts";
import {
  computeLeverageUtilization,
  EMPTY_LEVERAGE,
  LEVERAGE_CAUTION_PCT,
  LEVERAGE_HIGH_PCT,
  leverageUtilizationFromPortfolio,
  migrateLeverageFromPlanData,
  parseLeverageField,
  parseStoredLeverage,
} from "../src/lib/portfolio/leverage.ts";
import {
  expiringCallsWithinDays,
  netPremiumPercentOfBook,
  optionStrikeNotional,
  optionsNotionalVsBook,
  upcomingOptionExpiries,
} from "../src/lib/portfolio/options-risk.ts";
import { computeModifiedDietzReturn } from "../src/lib/portfolio/modified-dietz.ts";
import { mergeSessionCookieOptions } from "../src/lib/security/cookies.ts";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "../src/lib/security/headers.ts";
import {
  isProtectedRoute,
  isPublicRoute,
  PUBLIC_MARKETING_PATHS,
  PUBLIC_ROUTE_PATHS,
} from "../src/lib/security/protected-routes.ts";
import {
  canAccess,
  canCreateLimitedResource,
  getPlanLimit,
  PLAN_CAPS_ENFORCED,
} from "../src/lib/plans/access.ts";
import {
  canCreateRetirementFromPortfolio,
  canOpenBudgetPlanOnPlan,
  canOpenPortfolioOnPlan,
} from "../src/lib/plans/free-access.ts";
import type { PortfolioHoldingWithPrices } from "../src/types/portfolio.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

function holding(
  partial: Pick<PortfolioHoldingWithPrices, "id" | "symbol" | "type"> &
    Partial<PortfolioHoldingWithPrices>,
): PortfolioHoldingWithPrices {
  const quantity = partial.quantity ?? 1;
  const costPrice = partial.costPrice ?? 10;
  const currentValue = partial.currentValue ?? 10;
  return {
    name: partial.name ?? partial.symbol,
    sector: partial.sector ?? "Other",
    category: partial.category ?? "Other",
    subCategory: partial.subCategory ?? "Other",
    costPrice,
    quantity,
    addedAt: partial.addedAt ?? "2024-01-01T12:00:00.000Z",
    transactions: partial.transactions ?? [],
    currentPrice: partial.currentPrice ?? currentValue / quantity,
    costValue: partial.costValue ?? costPrice * quantity,
    currentValue,
    profitLoss: partial.profitLoss ?? currentValue - costPrice * quantity,
    profitLossPercent: partial.profitLossPercent ?? 0,
    portfolioPercent: partial.portfolioPercent ?? 0,
    isPriceLoading: false,
    ...partial,
  };
}

function withPercents(holdings: PortfolioHoldingWithPrices[]) {
  const total = holdings.reduce((sum, item) => sum + (item.currentValue ?? 0), 0);
  return holdings.map((item) => ({
    ...item,
    portfolioPercent: total > 0 ? ((item.currentValue ?? 0) / total) * 100 : 0,
  }));
}

// --- Concentration + risk chip ---
assert(CONCENTRATION_FLAG_PCT === 25, "flag threshold is 25%");
assert(CONCENTRATION_NOTE_PCT === 10, "note threshold is 10%");
assert(CASH_HEAVY_PCT === 40, "cash-heavy threshold is 40%");
assert(SLEEVE_DOMINANT_PCT === 50, "sleeve dominate threshold is 50%");
assert(concentrationNoteForWeight(25) === "flag", "25% is a flag");
assert(concentrationNoteForWeight(24.9) === "note", "24.9% is a note");
assert(concentrationNoteForWeight(10) === "note", "10% is a note");
assert(concentrationNoteForWeight(9.9) === "none", "9.9% is none");
assert(
  resolveRiskChip({ topNonCashPercent: 25, cashPercent: 50 }) === "concentrated",
  "25% non-cash name beats cash-heavy",
);
assert(
  resolveRiskChip({ topNonCashPercent: 24, cashPercent: 40 }) === "cash-heavy",
  "40% cash without 25% name is cash-heavy",
);
assert(
  resolveRiskChip({ topNonCashPercent: 9, cashPercent: 10 }) === "balanced",
  "low name + low cash is balanced",
);

const concentrated = withPercents([
  holding({
    id: "aapl",
    symbol: "AAPL",
    type: "stock",
    currentValue: 60,
    costValue: 40,
    portfolioPercent: 60,
  }),
  holding({
    id: "cash",
    symbol: "USD",
    type: "cash",
    currentValue: 40,
    costValue: 40,
    portfolioPercent: 40,
  }),
]);
const concentratedCheckup = buildInvestmentCheckup(concentrated, {
  costValue: 80,
  currentValue: 100,
  profitLoss: 20,
});
assert(concentratedCheckup.riskChip === "concentrated", "checkup flags 60% name");
assert(
  concentratedCheckup.concentration.topHoldingPercent === 60,
  "top holding % is 60",
);
assert(
  Math.abs(concentratedCheckup.concentration.top5Percent - 100) < 0.01,
  "top 5 % is 100 with two names",
);
assert(concentratedCheckup.concentration.nameCount === 2, "name count is 2");
assert(concentratedCheckup.concentration.note === "flag", "60% is a flag");
assert(
  concentratedCheckup.concentration.topHoldings.length === 2,
  "checkup lists top names for the hub",
);
assert(
  concentratedCheckup.concentration.topHolding?.symbol === "AAPL",
  "concentrated stock stays on the book",
);
assert(
  concentratedCheckup.nextAction.href === "/invest/portfolio",
  "concentrated next action opens the book",
);
assert(
  !concentratedCheckup.nextAction.label.toLowerCase().includes("analysis"),
  "concentrated next action does not send users to analysis",
);
assert(concentratedCheckup.cashPercent === 40, "cash % of book is 40");

const cashBook = withPercents([
  holding({
    id: "msft",
    symbol: "MSFT",
    type: "stock",
    currentValue: 20,
  }),
  holding({
    id: "cash3",
    symbol: "USD",
    type: "cash",
    currentValue: 80,
  }),
]);
const cashCheckup = buildInvestmentCheckup(cashBook, {
  costValue: 100,
  currentValue: 100,
  profitLoss: 0,
});
assert(cashCheckup.riskChip === "cash-heavy", "80% cash is cash-heavy");
assert(cashCheckup.mix.some((item) => item.type === "cash"), "mix includes cash");
assert(cashCheckup.mix.some((item) => item.type === "stock"), "mix includes stock");
assert(cashCheckup.dominatingSleeve?.type === "cash", "80% cash sleeve dominates");

const balanced = withPercents([
  holding({ id: "1", symbol: "AAA", type: "stock", currentValue: 20 }),
  holding({ id: "2", symbol: "BBB", type: "stock", currentValue: 20 }),
  holding({ id: "3", symbol: "CCC", type: "crypto", currentValue: 15 }),
  holding({ id: "4", symbol: "DDD", type: "stock", currentValue: 15 }),
  holding({ id: "5", symbol: "EEE", type: "stock", currentValue: 15 }),
  holding({ id: "6", symbol: "USD", type: "cash", currentValue: 15 }),
]);
const balancedCheckup = buildInvestmentCheckup(balanced, {
  costValue: 90,
  currentValue: 100,
  profitLoss: 10,
});
assert(balancedCheckup.riskChip === "balanced", "spread book is balanced");
assert(
  balancedCheckup.dominatingSleeve?.type === "stock",
  "name-balanced book can still have a stock sleeve over 50%",
);

const sleeveSpread = withPercents([
  holding({ id: "s1", symbol: "AAA", type: "stock", currentValue: 30 }),
  holding({ id: "c1", symbol: "BBB", type: "crypto", currentValue: 30 }),
  holding({ id: "u1", symbol: "USD", type: "cash", currentValue: 25 }),
  holding({ id: "x1", symbol: "MISC", type: "custom", currentValue: 15 }),
]);
const sleeveSpreadCheckup = buildInvestmentCheckup(sleeveSpread, {
  costValue: 100,
  currentValue: 100,
  profitLoss: 0,
});
assert(
  sleeveSpreadCheckup.dominatingSleeve === null,
  "no sleeve at 50% is not a dominate flag",
);
assert(
  sleeveSpreadCheckup.mix.find((item) => item.type === "custom")?.label === "Other",
  "custom sleeve is labeled Other",
);
assert(
  balancedCheckup.concentration.note === "note",
  "20% top name is a note not a flag",
);
assert(balancedCheckup.targetsAreDefault, "unset targets use 80/10/10/0");
assert(balancedCheckup.targets.stock === 80, "default stock target 80");
assert(balancedCheckup.targets.crypto === 10, "default crypto target 10");
assert(balancedCheckup.targets.cash === 10, "default cash target 10");
assert(balancedCheckup.targets.custom === 0, "default custom target 0");
assert(
  concentrationNoteForWeight(balancedCheckup.concentration.topHoldingPercent) ===
    "note",
  "table highlight: 20% of book is a note",
);
assert(
  concentrationNoteForWeight(concentratedCheckup.concentration.topHoldingPercent) ===
    "flag",
  "table highlight: 60% of book is a flag",
);

// --- Leverage util + migrate nulls ---
assert(LEVERAGE_CAUTION_PCT === 50, "caution at 50%");
assert(LEVERAGE_HIGH_PCT === 70, "high at 70%");

const missingLeverage = migrateLeverageFromPlanData({
  id: "old",
  name: "Old book",
  holdings: [],
});
assert(missingLeverage.marginUsed === null, "old plan marginUsed stays null");
assert(missingLeverage.equity === null, "old plan equity stays null");
assert(missingLeverage.buyingPower === null, "old plan buyingPower stays null");
assert(missingLeverage.broker === null, "old plan broker stays null");
assert(
  JSON.stringify(parseStoredLeverage(undefined)) === JSON.stringify(EMPTY_LEVERAGE),
  "missing leverage object is all nulls",
);
assert(
  parseStoredLeverage({ netLiquidation: 80_000 }).equity === 80_000,
  "netLiquidation aliases equity",
);
assert(
  parseStoredLeverage({ marginUsed: -5, equity: "x" }).marginUsed === null,
  "negative / junk values are not invented",
);

const unsetUtil = computeLeverageUtilization({
  marginUsed: null,
  equity: 50_000,
  cashValue: 10_000,
});
assert(unsetUtil.flag === "unset", "no margin used → unset");
assert(unsetUtil.utilizationPercent === null, "unset util is null");

const noCushion = computeLeverageUtilization({
  marginUsed: 10_000,
  equity: null,
  cashValue: 0,
});
assert(noCushion.flag === "unset", "margin without equity or cash → unset");

const fromCash = computeLeverageUtilization({
  marginUsed: 10_000,
  equity: null,
  cashValue: 10_000,
});
assert(fromCash.cushionSource === "cash", "falls back to book cash");
assert(fromCash.utilizationPercent === 50, "10k / (10k+10k) = 50%");
assert(fromCash.flag === "caution", "50% is caution");

const okUtil = computeLeverageUtilization({
  marginUsed: 20_000,
  equity: 80_000,
  cashValue: 5_000,
});
assert(okUtil.cushionSource === "equity", "typed equity beats cash");
assert(Math.abs((okUtil.utilizationPercent ?? 0) - 20) < 0.01, "20k / 100k = 20%");
assert(okUtil.flag === "ok", "under 50% is ok");

const highUtil = leverageUtilizationFromPortfolio(
  { marginUsed: 70_000, equity: 30_000, buyingPower: null, broker: "IBKR" },
  99_000,
);
assert(highUtil.utilizationPercent === 70, "70k / 100k = 70%");
assert(highUtil.flag === "high", "70% is high");
assert(highUtil.cushionSource === "equity", "does not use cash when equity is set");

assert(parseLeverageField("") === null, "blank leverage input stays null");
assert(parseLeverageField("  ") === null, "whitespace leverage input stays null");
assert(parseLeverageField("-1") === null, "negative leverage input stays null");
assert(parseLeverageField("abc") === null, "junk leverage input stays null");
const typedUtil = computeLeverageUtilization({
  marginUsed: parseLeverageField("70000"),
  equity: parseLeverageField("30000"),
  cashValue: 0,
});
assert(typedUtil.utilizationPercent === 70, "labeled 70k / 30k fields compute 70%");
assert(typedUtil.flag === "high", "labeled fields still flag high at 70%");

// --- Options risk vs book (no greeks) ---
assert(netPremiumPercentOfBook(500, 10_000) === 5, "net premium is 5% of book");
assert(netPremiumPercentOfBook(500, 0) === null, "no book value → no %");
assert(optionStrikeNotional({ contracts: 2, strikePrice: 50 }) === 10_000, "2×50×100 notional");
assert(
  optionsNotionalVsBook(
    [{ contracts: 2, strikePrice: 50, displayStatus: "active" }],
    50_000,
  ).percentOfBook === 20,
  "notional is 20% of book",
);
assert(
  expiringCallsWithinDays(
    [
      {
        ticker: "AAPL",
        optionType: "sell_call",
        expiryDate: "2099-01-15",
        displayStatus: "active",
        dte: 7,
        contracts: 1,
        strikePrice: 200,
        cost: 300,
      },
      {
        ticker: "MSFT",
        optionType: "buy_put",
        expiryDate: "2099-01-15",
        displayStatus: "active",
        dte: 5,
        contracts: 1,
        strikePrice: 400,
        cost: 200,
      },
    ],
    14,
    "2099-01-08",
  ).map((row) => row.ticker).join(",") === "AAPL",
  "≤14 DTE call is listed; put is not",
);
const expiries = upcomingOptionExpiries(
  [
    {
      ticker: "AAPL",
      expiryDate: "2026-09-18",
      displayStatus: "active",
      dte: 31,
    },
    {
      ticker: "MSFT",
      expiryDate: "2026-08-21",
      displayStatus: "active",
      dte: 3,
    },
    {
      ticker: "OLD",
      expiryDate: "2026-01-01",
      displayStatus: "closed",
      dte: null,
    },
  ],
  3,
  "2026-08-18",
);
assert(expiries.length === 2, "only active future expiries");
assert(expiries[0]?.ticker === "MSFT", "soonest expiry first");
assert(expiries[1]?.ticker === "AAPL", "later expiry second");

// --- Allocation drift ---
const drift = buildAllocationDrift(
  { stock: 90, crypto: 10, cash: 0, custom: 0 },
  { stock: 80, crypto: 10, cash: 10, custom: 0 },
  100_000,
);
const stockRow = drift.find((row) => row.type === "stock");
const cashRow = drift.find((row) => row.type === "cash");
assert(stockRow?.action === "trim", "overweight stock is trim");
assert(Math.abs((stockRow?.dollarDelta ?? 0) - 10_000) < 0.01, "trim $10k stock");
assert(cashRow?.action === "add", "underweight cash is add");
assert(Math.abs((cashRow?.dollarDelta ?? 0) + 10_000) < 0.01, "add $10k cash");

const savedTargets = buildInvestmentCheckup(
  cashBook,
  { costValue: 100, currentValue: 100, profitLoss: 0 },
  { storedTargets: { stock: 50, crypto: 0, cash: 50, custom: 0 } },
);
assert(!savedTargets.targetsAreDefault, "saved targets are not the default");
assert(
  savedTargets.drift.find((row) => row.type === "cash")?.action === "trim",
  "80% cash vs 50% target is trim",
);
assert(
  savedTargets.drift.find((row) => row.type === "stock")?.action === "add",
  "20% stock vs 50% target is add",
);

const overlay = buildInvestmentCheckup(
  cashBook,
  { costValue: 100, currentValue: 100, profitLoss: 0 },
  { hasOptions: true, netPremium: 5 },
);
assert(overlay.optionsOverlay != null, "options overlay present when options exist");
assert(
  overlay.optionsOverlay?.percentOfPortfolio === 5,
  "net premium is 5% of book",
);

// --- Modified Dietz: only with multi-date or sell flows ---
const singleSeed: PortfolioHoldingWithPrices[] = [
  holding({
    id: "seed",
    symbol: "AAA",
    type: "stock",
    currentValue: 120,
    costValue: 100,
    transactions: [
      {
        id: "t1",
        type: "buy",
        quantity: 10,
        pricePerUnit: 10,
        date: "2024-01-01",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ],
  }),
];
assert(
  computeModifiedDietzReturn(singleSeed, "2026-01-01") === null,
  "single buy date does not invent a second return",
);

const multiFlow: PortfolioHoldingWithPrices[] = [
  holding({
    id: "flow",
    symbol: "AAA",
    type: "stock",
    currentValue: 150,
    costValue: 130,
    transactions: [
      {
        id: "b1",
        type: "buy",
        quantity: 10,
        pricePerUnit: 10,
        date: "2024-01-01",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "b2",
        type: "buy",
        quantity: 3,
        pricePerUnit: 10,
        date: "2025-01-01",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ],
  }),
];
const dietz = computeModifiedDietzReturn(multiFlow, "2026-01-01");
assert(dietz != null && Number.isFinite(dietz), "multi-date buys yield Modified Dietz");

// --- Auth route matcher ---
for (const path of PUBLIC_MARKETING_PATHS) {
  assert(!isProtectedRoute(path), `${path} stays public`);
}
for (const path of PUBLIC_ROUTE_PATHS) {
  assert(isPublicRoute(path), `${path} is on the public-route list`);
  assert(!isProtectedRoute(path), `${path} is not gated`);
}
assert(isPublicRoute("/auth/callback"), "/auth/callback is public");
assert(isPublicRoute("/auth/reset"), "/auth/reset is public");
assert(!isProtectedRoute("/auth/callback"), "/auth/callback stays public");
assert(!isProtectedRoute("/auth/reset"), "/auth/reset stays public");
assert(!isProtectedRoute("/api/prices"), "/api/prices is not a page gate");
assert(safeAuthNextPath("https://evil.test") === "/invest", "rejects absolute next");
assert(safeAuthNextPath("//evil.test") === "/invest", "rejects protocol-relative next");
assert(safeAuthNextPath("/home") === "/invest", "legacy /home next lands on Invest");
assert(safeAuthNextPath("/invest") === "/invest", "keeps a relative next");

const mustProtect = [
  "/home",
  "/invest",
  "/freedom",
  "/freedom/plans",
  "/freedom/plans/abc",
  "/retire",
  "/retire/plans",
  "/retire/plans/abc",
  "/watchlist",
  "/watchlist/abc",
  "/invest/watchlist",
  "/invest/watchlist/abc",
  "/analysis",
  "/analysis/AAPL",
  "/settings",
  "/analytics",
  "/performance",
  "/markets",
  "/portfolio",
  "/portfolio/abc",
  "/invest/portfolio",
  "/invest/portfolio/abc",
  "/options",
  "/invest/options",
  "/holdings",
  "/budget",
  "/budget/plans/abc",
  "/market",
];
for (const path of mustProtect) {
  assert(isProtectedRoute(path), `${path} requires a session`);
}
assert(isProtectedRoute("/markets"), "/markets is gated separately from /market");
assert(isProtectedRoute("/market"), "/market is gated");
assert(destinationForLegacyInvestPath("/analytics") === "/invest", "/analytics folds into checkup");
assert(destinationForLegacyInvestPath("/performance") === "/invest", "/performance folds into checkup");
assert(destinationForLegacyInvestPath("/holdings") === "/invest/portfolio", "/holdings is leftover of the book");
assert(destinationForLegacyInvestPath("/markets") === "/invest", "/markets leftover goes to Invest");
assert(destinationForLegacyInvestPath("/market") === "/invest", "/market leftover goes to Invest");
assert(destinationForLegacyInvestPath("/analysis") === "/invest", "/analysis hub folds into Invest");
assert(destinationForLegacyInvestPath("/analysis/AAPL") === "/invest", "/analysis/[symbol] folds into Invest");
assert(destinationForLegacyInvestPath("/signin") === "/login", "/signin aliases /login");
assert(destinationForLegacyInvestPath("/pricing") === "/", "/pricing redirects home");
assert(isPublicRoute("/pricing"), "/pricing stays public so the redirect is not gated");
assert(!PLAN_CAPS_ENFORCED, "plan caps are not enforced");
assert(getPlanLimit("free", "budget") === null, "free budget cap is unlocked");
assert(getPlanLimit("free", "portfolio") === null, "free portfolio cap is unlocked");
assert(getPlanLimit("free", "retirement") === null, "free retirement cap is unlocked");
assert(canCreateLimitedResource("free", "budget", 99), "creating many budgets is allowed");
assert(canCreateLimitedResource("free", "portfolio", 99), "creating many books is allowed");
assert(canCreateLimitedResource("free", "retirement", 99), "creating many retire plans is allowed");
assert(canAccess("free", "retirement_from_portfolio"), "retire-from-portfolio is unlocked");
assert(canCreateRetirementFromPortfolio("free"), "import from portfolio is unlocked");
assert(
  canOpenPortfolioOnPlan("free", { id: "p2", isPrimary: false }),
  "secondary books are openable",
);
assert(
  canOpenBudgetPlanOnPlan(
    "free",
    [
      { id: "a", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", createdAt: "2026-02-01T00:00:00.000Z" },
    ],
    "b",
  ),
  "any budget plan is openable",
);
assert(destinationForLegacyInvestPath("/invest") === null, "/invest itself is not redirected");
assert(destinationForLegacyInvestPath("/portfolio") === "/invest/portfolio", "the book folds under Invest");
assert(
  destinationForLegacyInvestPath("/portfolio/abc") === "/invest/portfolio/abc",
  "a book id folds under Invest",
);
assert(destinationForLegacyInvestPath("/watchlist") === "/invest/watchlist", "watchlist folds under Invest");
assert(
  destinationForLegacyInvestPath("/watchlist/abc") === "/invest/watchlist/abc",
  "a watchlist id folds under Invest",
);
assert(destinationForLegacyInvestPath("/options") === "/invest/options", "options folds under Invest");

assert(
  PRIMARY_NAV_TITLES.join(",") === "Budget,Invest,Freedom",
  "signed-in chrome is three products — Home is not a pillar",
);
assert(
  !PRIMARY_NAV_TITLES.includes("Home") && !PRIMARY_NAV_TITLES.includes("Register"),
  "Home and Register are not top-level tabs",
);
assert(
  SIGNED_IN_PRIMARY_NAV.every((item) => item.title !== "Settings"),
  "Settings is not a top-level peer",
);
assert(
  SIGNED_IN_FOOTER_NAV.some((item) => item.href === "/settings"),
  "Settings stays in the account menu, not as a product tab",
);
assert(
  INVEST_CHILD_NAV.map((item) => item.href).join(",") ===
    "/invest/portfolio,/invest/watchlist,/invest/options",
  "Invest children are book, queue, and options under /invest",
);
assert(
  !INVEST_CHILD_NAV.some((item) => item.href === "/market" || item.href === "/analysis"),
  "Market and Analysis are not Invest children",
);
assert(pillarForPath("/home") === "invest", "legacy /home maps to Invest");
assert(destinationForLegacyInvestPath("/home") === "/invest", "/home redirects to Invest");
assert(destinationForLegacyInvestPath("/chat") === "/invest", "/chat is unshipped");
assert(destinationForLegacyInvestPath("/chat/thread") === "/invest", "/chat/* is unshipped");
assert(destinationForLegacyInvestPath("/assistant") === "/invest", "/assistant is unshipped");
assert(destinationForLegacyInvestPath("/assistant/ask") === "/invest", "/assistant/* is unshipped");
assert(isPillarHub("/invest"), "Invest hub has no up-link");
assert(isPillarHub("/budget"), "Budget hub has no up-link");
assert(isPillarHub("/freedom"), "Freedom hub has no up-link");
assert(!isPillarHub("/budget/plans/abc"), "a budget plan is nested");
assert(pillarLabel("/freedom/plans/abc") === "Freedom", "Freedom never reads as Retire");
assert(pillarLabel("/invest/options") === "Invest", "options sit inside Invest");
assert(pillarForPath("/budget/plans/abc") === "budget", "budget plan is Budget");
assert(pillarForPath("/invest/portfolio/abc") === "invest", "nested book is Invest");
assert(pillarForPath("/options") === "invest", "legacy options is still Invest");
assert(pillarForPath("/freedom/plans/abc") === "retire", "plan editor is Freedom");
assert(pillarForPath("/retire/plans/abc") === "retire", "legacy /retire still maps to Freedom");
assert(pillarHomePath("/invest/watchlist/abc") === "/invest", "up from watchlist is Invest");
assert(pillarHomePath("/budget/plans/abc/transactions") === "/budget", "up from register is Budget");
assert(pillarHomePath("/freedom/plans/abc") === "/freedom", "up from a plan is Freedom");
assert(pillarHomePath("/retire/plans/abc") === "/freedom", "legacy up-link is Freedom");
assert(destinationForLegacyInvestPath("/retire") === "/freedom", "/retire redirects to Freedom");
assert(
  destinationForLegacyInvestPath("/retire/plans/abc") === "/freedom/plans/abc",
  "/retire/plans/:id redirects to Freedom",
);
assert(isInvestPath("/invest/options") === true, "options under Invest is Invest");
assert(investPortfolioPath("abc") === "/invest/portfolio/abc", "book path is nested");
assert(resolvePageTitle("/invest/options") === "Options", "options title");
assert(resolvePageTitle("/") === "InvestSalsa", "marketing title");
assert(isPortfolioDetailPath("/invest/portfolio/abc") === true, "nested book is a detail path");
assert(isPortfolioDetailPath("/invest/portfolio") === false, "book list is not a detail path");
assert(resolvePortfolioViewScope("/invest") === "primary", "checkup uses primary book");
assert(resolvePortfolioViewScope("/invest/portfolio/abc") === "active", "open book uses active");

assert(holdingExpandShowsScreens("stock") === true, "stock expand shows screens");
assert(holdingExpandShowsScreens("crypto") === false, "crypto expand skips screens");
assert(holdingExpandShowsScreens("cash") === false, "cash expand skips screens");
assert(holdingExpandShowsScreens("custom") === false, "custom expand skips screens");
assert(classifyRevenuePath([80, 90, 110]) === "growing", "rising revenue is growing");
assert(classifyRevenuePath([100, 101, 99]) === "flat", "sideways revenue is flat");
assert(classifyRevenuePath([120, 90, 80]) === "stall", "falling revenue is stall");
assert(classifyRevenuePath([50]) === null, "one year is not a path");
assert(pickNextEarningsDate(null) === null, "missing earnings shows nothing");
assert(pickNextEarningsDate("") === null, "blank earnings shows nothing");
assert(pickNextEarningsDate("not-a-date") === null, "junk earnings shows nothing");
assert(
  pickNextEarningsDate("2020-01-15", new Date("2026-08-18")) === null,
  "past earnings date is omitted",
);
assert(
  pickNextEarningsDate("2026-10-20", new Date("2026-08-18")) === "2026-10-20",
  "future warehouse earnings date is kept",
);

const stockFacts = buildHoldingExpandFacts({
  type: "stock",
  size: { value: 100, profitLoss: 10, portfolioPercent: 25 },
  whyMoved: { change: 2, changePercent: 1.5, volume: 20, averageVolume: 10 },
  incomeRows: [
    { calendarYear: "2023", revenue: 80 },
    { calendarYear: "2024", revenue: 100 },
    { calendarYear: "2025", revenue: 120 },
  ],
  balanceRow: { cashAndShortTermInvestments: 40, totalDebt: 10 },
  earningsRaw: { nextEarningsDate: "2026-11-01" },
  now: new Date("2026-08-18"),
});
assert(stockFacts.showScreens === true, "stock facts include screens");
assert(stockFacts.screens?.revenuePath?.kind === "growing", "stock revenue path is growing");
assert(stockFacts.screens?.cashVsDebt?.netCash === true, "cash above debt is net cash");
assert(stockFacts.nextEarningsDate === "2026-11-01", "stock shows warehouse earnings");
assert(stockFacts.whyMoved.volumeVsTypical === 2, "volume vs typical is a ratio");
assert(!("score" in stockFacts), "expand payload has no score");
assert(!("rating" in stockFacts), "expand payload has no rating");
assert(
  !holdingExpandHasRatingUi(JSON.stringify(stockFacts)),
  "stock expand copy has no rating UI",
);
assert(!("peers" in stockFacts), "expand payload has no peers");
assert(!("chart" in stockFacts), "expand payload has no chart dump");
assert(!("tabs" in stockFacts), "expand payload has no tabs");
assert(
  whyMovedFactLine({
    changePercent: 1.5,
    volumeVsTypical: 2,
    headlineTitle: "Apple lifts revenue",
  }) === "+1.50% · 2.0× typical · Apple lifts revenue",
  "why-it-moved is one fact line",
);
assert(
  whyMovedFactLine({
    changePercent: -3,
    volumeVsTypical: null,
    headlineTitle: null,
  }) === "-3.00%",
  "unexplained move shows the move and stops",
);
assert(
  whyMovedFactLine({
    changePercent: 1,
    volumeVsTypical: null,
    headlineTitle: "  ",
  }) === "+1.00%",
  "blank headline does not invent a thesis",
);

const aaplOptions = optionsOnUnderlying(
  [
    {
      ticker: "AAPL",
      displayStatus: "active",
      optionType: "sell_call",
      dte: 14,
      strikePrice: 180,
      currentStockPrice: 190,
      contracts: 2,
      cost: 400,
    },
    {
      ticker: "AAPL",
      displayStatus: "expired",
      optionType: "sell_call",
      dte: -2,
      strikePrice: 170,
      currentStockPrice: 190,
      contracts: 1,
      cost: 100,
    },
    {
      ticker: "MSFT",
      displayStatus: "active",
      optionType: "buy_put",
      dte: 7,
      strikePrice: 400,
      currentStockPrice: 390,
      contracts: 1,
      cost: 250,
    },
  ],
  "AAPL",
  190,
);
assert(aaplOptions.length === 1, "only active options on the same underlying");
assert(aaplOptions[0]?.dte === 14, "overlay shows DTE");
assert(aaplOptions[0]?.strike === 180, "overlay shows strike");
assert(aaplOptions[0]?.spot === 190, "overlay shows spot");
assert(aaplOptions[0]?.strikeVsSpot === -10, "strike vs spot is a number");
assert(aaplOptions[0]?.contracts === 2, "overlay shows contracts");
assert(aaplOptions[0]?.premium === 400, "sold premium is received");
assert(!("optionType" in aaplOptions[0]!), "overlay has no strategy field");
assert(!("strategy" in aaplOptions[0]!), "overlay has no strategy label");
assert(
  !/buy call|sell call|covered|protective|debit|credit spread/i.test(
    JSON.stringify(aaplOptions),
  ),
  "overlay copy has no strategy labels",
);
assert(
  optionsOnUnderlying(
    [
      {
        ticker: "AAPL",
        displayStatus: "active",
        optionType: "buy_put",
        dte: 21,
        strikePrice: 170,
        currentStockPrice: 190,
        contracts: 1,
        cost: 150,
      },
    ],
    "AAPL",
  )[0]?.premium === -150,
  "paid premium is negative book risk",
);

const cryptoFacts = buildHoldingExpandFacts({
  type: "crypto",
  size: { value: 20, profitLoss: -2, portfolioPercent: 5 },
  whyMoved: { change: -1, changePercent: -3 },
  incomeRows: [{ calendarYear: "2025", revenue: 999 }],
  balanceRow: { cashAndShortTermInvestments: 1, totalDebt: 0 },
  earningsRaw: { nextEarningsDate: "2026-11-01" },
  now: new Date("2026-08-18"),
});
assert(cryptoFacts.showScreens === false, "crypto skips the two screens");
assert(cryptoFacts.screens === null, "crypto screens are omitted");
assert(cryptoFacts.nextEarningsDate === null, "crypto does not invent earnings");

const cashFacts = buildHoldingExpandFacts({
  type: "cash",
  earningsRaw: { nextEarningsDate: "2026-11-01" },
  now: new Date("2026-08-18"),
});
assert(cashFacts.showScreens === false, "cash skips screens");
assert(cashFacts.nextEarningsDate === null, "cash does not show earnings");

const customFacts = buildHoldingExpandFacts({
  type: "custom",
  earningsRaw: { nextEarningsDate: "2026-11-01" },
});
assert(customFacts.nextEarningsDate === null, "custom does not show earnings");
assert(
  pickNextEarningsDate(undefined) === null,
  "undefined earnings shows nothing",
);
assert(
  !holdingExpandHasRatingUi("Price +2.1% · volume 1.2× typical"),
  "plain move copy is not rating UI",
);
assert(
  holdingExpandHasRatingUi("InvestSalsa Rating 72"),
  "rating label is detected as rating UI",
);
assert(
  holdingExpandHasRatingUi("Insight Score 0–100 belong"),
  "score / belong copy is rating UI",
);

const movers = ownedNameMovers(
  [
    { id: "aapl", symbol: "AAPL", name: "Apple", type: "stock", quantity: 2 },
    { id: "usd", symbol: "USD", name: "Cash", type: "cash", quantity: 100 },
    { id: "watch", symbol: "NVDA", name: "Nvidia", type: "stock", quantity: 0 },
  ],
  {
    AAPL: { change: 3, changePercent: 2.5 },
    NVDA: { change: 10, changePercent: 8 },
  },
);
assert(movers.length === 1, "movers stay on owned book names");
assert(movers[0]?.symbol === "AAPL", "zero-qty and cash names are not movers");

const leftoverPlan = createEmptyBudgetPlan("Leftover");
leftoverPlan.id = "budget-1";
leftoverPlan.createdAt = "2026-01-01T00:00:00.000Z";
leftoverPlan.updatedAt = "2026-01-02T00:00:00.000Z";
leftoverPlan.currency = "CAD";
leftoverPlan.accounts = [
  {
    id: "acct-1",
    name: "Chequing",
    type: "chequing",
    sortOrder: 0,
    onBudget: true,
  },
];
leftoverPlan.transactions = [
  {
    id: "in-1",
    date: "2026-08-01",
    amount: 250,
    type: "inflow",
    payee: "Pay",
    accountId: "acct-1",
    categoryId: null,
    cleared: "cleared",
    approved: true,
  },
];
const leftoverSnap = leftoverFromBudgetPlan(leftoverPlan, "2026-08");
assert(leftoverSnap?.amount === 250, "leftover snapshot is RTA 250");
assert(leftoverSnap?.currency === "CAD", "leftover keeps budget currency");
assert(
  leftoverFromBudgetPlans([leftoverPlan], "2026-08")?.amount === 250,
  "plan-list leftover matches the same snapshot",
);
assert(
  leftoverFromBudgetPlan(leftoverPlan, "2025-01") == null,
  "no leftover when RTA is not positive",
);
assert(pickOpenablePlan([leftoverPlan])?.id === "budget-1", "openable leftover plan is the only plan");

const appliedNew = applyLeftoverToBookCash([], {
  amount: leftoverSnap!.amount,
  currency: leftoverSnap!.currency,
  date: "2026-08-18",
});
assert(appliedNew.created === true, "missing cash holding is created");
assert(appliedNew.applied === 250, "applied leftover amount is 250");
assert(appliedNew.holdings.length === 1, "one cash holding after apply");
assert(appliedNew.holdings[0]?.type === "cash", "new holding is cash");
assert(appliedNew.holdings[0]?.quantity === 250, "cash qty equals leftover");
assert(appliedNew.holdings[0]?.cashCurrency === "CAD", "cash currency matches leftover");
assert(leftoverFromBudgetPlan(leftoverPlan, "2026-08")?.amount === 250, "budget leftover is unchanged after apply");

const appliedAgain = applyLeftoverToBookCash(appliedNew.holdings, {
  amount: 50,
  currency: "CAD",
  date: "2026-08-19",
});
assert(appliedAgain.created === false, "matching cash is increased, not duplicated");
assert(appliedAgain.holdings.length === 1, "still one CAD cash holding");
assert(appliedAgain.holdings[0]?.quantity === 300, "cash increased by 50");

const skipped = applyLeftoverToBookCash(appliedAgain.holdings, {
  amount: 0,
  currency: "CAD",
  date: "2026-08-19",
});
assert(skipped.applied === 0, "zero leftover does not invent cash");
assert(skipped.holdings[0]?.quantity === 300, "zero leftover leaves cash qty alone");

const exportPayload = buildAccountExportPayload({
  exportedAt: "2026-08-18T00:00:00.000Z",
  userId: "user-1",
  user_budget_plans: [{ id: "b1", data: leftoverPlan }],
  user_retirement_plans: [],
  user_portfolio_plans: [{ id: "p1", data: { holdings: appliedNew.holdings } }],
});
assert(isAccountExportPayload(exportPayload), "export payload has the three blobs");
assert(
  Array.isArray(exportPayload.user_budget_plans) &&
    Array.isArray(exportPayload.user_retirement_plans) &&
    Array.isArray(exportPayload.user_portfolio_plans),
  "export shape is the three user_* arrays",
);
assert(
  !("user_watchlist_plans" in exportPayload),
  "export does not add extra tables",
);

// --- Cookies ---
const http = mergeSessionCookieOptions(undefined, false);
assert(http.secure !== true, "local http does not force Secure");
assert(http.sameSite === "lax", "SameSite defaults to lax");
const https = mergeSessionCookieOptions(undefined, true);
assert(https.secure === true, "https sets Secure");
const keep = mergeSessionCookieOptions({ secure: false, sameSite: "strict" }, true);
assert(keep.secure === false, "explicit Secure false is preserved");
assert(keep.sameSite === "strict", "explicit SameSite is preserved");

// --- Headers / CSP ---
const csp = buildContentSecurityPolicy({
  supabaseUrl: "https://abc.supabase.co",
});
assert(csp.includes("default-src 'self'"), "CSP default-src self");
assert(csp.includes("https://*.supabase.co"), "CSP allows Supabase");
assert(csp.includes("https://abc.supabase.co"), "CSP includes project URL");
assert(!csp.includes("OPENROUTER"), "CSP does not mention OpenRouter");
assert(!csp.includes("financialmodelingprep.com"), "CSP connect-src skips FMP");
const prodHeaders = buildSecurityHeaders({ production: true });
assert(
  prodHeaders.some((h) => h.key === "Strict-Transport-Security"),
  "HSTS on production",
);
assert(
  prodHeaders.some((h) => h.key === "X-Content-Type-Options" && h.value === "nosniff"),
  "nosniff",
);
assert(
  prodHeaders.some((h) => h.key === "X-Frame-Options" && h.value === "DENY"),
  "DENY framing",
);
const localHeaders = buildSecurityHeaders({ production: false });
assert(
  !localHeaders.some((h) => h.key === "Strict-Transport-Security"),
  "no HSTS outside production",
);

if (failed > 0) {
  console.error(`\n${failed} failing assertion(s)`);
  process.exit(1);
}
console.log("\nall invest unit tests passed");
