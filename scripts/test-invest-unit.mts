/**
 * Invest checkup: concentration, risk chip, allocation drift, auth routes.
 *   npx tsx --tsconfig tsconfig.json scripts/test-invest-unit.mts
 */
import { destinationForLegacyInvestPath } from "../src/lib/invest/legacy-redirects.ts";
import { buildAllocationDrift } from "../src/lib/portfolio/allocation-targets.ts";
import {
  buildInvestmentCheckup,
  CASH_HEAVY_PCT,
  CONCENTRATION_FLAG_PCT,
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
  parseStoredLeverage,
} from "../src/lib/portfolio/leverage.ts";
import {
  netPremiumPercentOfBook,
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
  PUBLIC_MARKETING_PATHS,
} from "../src/lib/security/protected-routes.ts";
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
  concentratedCheckup.concentration.topHolding?.analysisHref?.startsWith(
    "/analysis/AAPL",
  ) === true,
  "concentrated stock deep-links to analysis",
);
assert(
  concentratedCheckup.concentration.topHoldings[0]?.analysisHref?.includes(
    "AAPL",
  ) === true,
  "top-name row is analysis-clickable",
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

// --- Options risk vs book (no greeks) ---
assert(netPremiumPercentOfBook(500, 10_000) === 5, "net premium is 5% of book");
assert(netPremiumPercentOfBook(500, 0) === null, "no book value → no %");
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
assert(!isProtectedRoute("/auth/callback"), "/auth/callback stays public");
assert(!isProtectedRoute("/api/prices"), "/api/prices is not a page gate");

const mustProtect = [
  "/home",
  "/invest",
  "/retire",
  "/retire/plans",
  "/retire/plans/abc",
  "/watchlist",
  "/watchlist/abc",
  "/analysis",
  "/analysis/AAPL",
  "/settings",
  "/analytics",
  "/performance",
  "/markets",
  "/portfolio",
  "/portfolio/abc",
  "/options",
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
assert(destinationForLegacyInvestPath("/holdings") === "/portfolio", "/holdings is leftover of the book");
assert(destinationForLegacyInvestPath("/markets") === "/market", "/markets leftover goes to Market");
assert(destinationForLegacyInvestPath("/invest") === null, "/invest itself is not redirected");
assert(destinationForLegacyInvestPath("/portfolio") === null, "the book stays");

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
