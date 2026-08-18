/**
 * Retirement planner math: target nest egg, contributions, income,
 * depletion, Monte Carlo success, and old-document migrate.
 *   npx tsx --tsconfig tsconfig.json scripts/test-retire-unit.mts
 */
import { computeRetirementDashboard, verdictFromGap } from "../src/lib/retirement/dashboard.ts";
import {
  impliedPathSentence,
  whatIfLeverSentence,
} from "../src/lib/retirement/path-copy.ts";
import {
  isSuccessfulPath,
  runRetirementMonteCarlo,
  type MonteCarloPercentileBand,
  type MonteCarloResult,
} from "../src/lib/retirement/monte-carlo.ts";
import {
  formatOutlookAge,
  nudgeAnnualSavings,
  nudgeAnnualSpending,
  nudgeRetirementAge,
  outlookChartRows,
  outlookLivesFromResult,
  outlookSentence,
} from "../src/lib/retirement/outlook.ts";
import { normalizeRetirementPlan } from "../src/lib/retirement/normalize.ts";
import { refreshAssetsFromPortfolio } from "../src/lib/retirement/portfolio-import.ts";
import {
  computeRetirementProjections,
  findDepletionAge,
  findDepletionYear,
  nestEggAtRetirement,
} from "../src/lib/retirement/projections.ts";
import { buildProjectionChartData } from "../src/lib/retirement/chart-data.ts";
import {
  applyScenario,
  buildWhatIfScenarios,
  compareRetirementScenarios,
  defaultExtraAnnualSavings,
} from "../src/lib/retirement/scenarios.ts";
import { computeTargetNestEgg, presentValue } from "../src/lib/retirement/target.ts";
import type { PortfolioHolding } from "../src/types/portfolio.ts";
import {
  DEFAULT_CURRENT_AGE,
  DEFAULT_PLAN_CURRENCY,
  DEFAULT_PLAN_END_AGE,
  DEFAULT_VOLATILITY_BY_TYPE,
  createEmptyPlan,
  type RetirementPlan,
  type RetirementPlanAsset,
} from "../src/types/retirement.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

const CURRENT_YEAR = 2026;

function asset(
  partial: Pick<RetirementPlanAsset, "id" | "symbol" | "unitPrice" | "quantity"> &
    Partial<RetirementPlanAsset>,
): RetirementPlanAsset {
  return {
    name: partial.name ?? partial.symbol,
    type: partial.type ?? "cash",
    expectedCagr: partial.expectedCagr ?? 0,
    ...partial,
  };
}

function plan(overrides: Partial<RetirementPlan> = {}): RetirementPlan {
  const base = createEmptyPlan("Test plan");
  return {
    ...base,
    id: "plan-1",
    currentAge: 40,
    retirementAge: 65,
    retirementYear: CURRENT_YEAR + 25,
    planEndAge: 90,
    inflationRate: 0,
    annualLifestyleSpending: 40_000,
    withdrawalRate: 4,
    annualContribution: 0,
    incomeStreams: [],
    assets: [
      asset({
        id: "cash-1",
        symbol: "CASH",
        unitPrice: 1,
        quantity: 100_000,
        expectedCagr: 0,
        type: "cash",
      }),
    ],
    ...overrides,
  };
}

// --- Target nest egg -------------------------------------------------------

assert(computeTargetNestEgg(60_000, 4) === 1_500_000, "4% of $60k spend needs $1.5M");
assert(computeTargetNestEgg(80_000, 5) === 1_600_000, "5% of $80k spend needs $1.6M");
assert(computeTargetNestEgg(0, 4) === 0, "zero spend needs zero nest egg");
assert(computeTargetNestEgg(60_000, 0) === 0, "zero withdrawal rate is not a target");
assert(presentValue(1_300_000, 0, 10) === 1_300_000, "0% inflation present value is unchanged");
assert(
  Math.abs(presentValue(1_060_000, 6, 1) - 1_000_000) < 1e-6,
  "1 year of 6% inflation discounts $1.06M to $1M",
);

// --- Contributions in accumulation ----------------------------------------

const saving = plan({
  annualContribution: 10_000,
  retirementYear: CURRENT_YEAR + 2,
  retirementAge: 42,
  annualLifestyleSpending: 0,
});
const savingRows = computeRetirementProjections(saving, { currentYear: CURRENT_YEAR });
assert(savingRows.length > 2, "projects through plan end");
assert(savingRows[0].contribution === 10_000, "contributes in the first accumulation year");
assert(savingRows[1].contribution === 10_000, "contributes in the second accumulation year");
assert(savingRows[2].contribution === 0, "stops contributing in the retirement year");
assert(
  Math.round(savingRows[1].closingBalance) === 120_000,
  `two $10k contributions land in the pot (got ${savingRows[1].closingBalance})`,
);

const noSave = plan({
  annualContribution: 0,
  retirementYear: CURRENT_YEAR + 2,
  retirementAge: 42,
  annualLifestyleSpending: 0,
});
const noSaveRows = computeRetirementProjections(noSave, { currentYear: CURRENT_YEAR });
assert(
  Math.round(noSaveRows[1].closingBalance) === 100_000,
  "without contributions the pot stays at $100k when CAGR is 0",
);

// --- Income reduces withdrawals -------------------------------------------

const retiredNow = plan({
  currentAge: 65,
  retirementAge: 65,
  retirementYear: CURRENT_YEAR,
  planEndAge: 70,
  annualLifestyleSpending: 20_000,
  incomeStreams: [
    {
      id: "cpp",
      name: "CPP",
      kind: "cpp",
      annualAmount: 8_000,
      startAge: 65,
      colaWithInflation: false,
    },
  ],
});
const incomeRows = computeRetirementProjections(retiredNow, {
  currentYear: CURRENT_YEAR,
});
assert(incomeRows[0].lifestyleSpending === 20_000, "spending stays the lifestyle number");
assert(incomeRows[0].income === 8_000, "CPP counts in the retirement year");
assert(
  incomeRows[0].portfolioWithdrawal === 12_000,
  `withdrawal is spend minus income (got ${incomeRows[0].portfolioWithdrawal})`,
);
assert(
  Math.round(incomeRows[0].closingBalance) === 88_000,
  `portfolio only funds the gap (got ${incomeRows[0].closingBalance})`,
);

const covered = plan({
  currentAge: 65,
  retirementAge: 65,
  retirementYear: CURRENT_YEAR,
  planEndAge: 67,
  annualLifestyleSpending: 10_000,
  incomeStreams: [
    {
      id: "oas",
      name: "OAS",
      kind: "oas",
      annualAmount: 15_000,
      startAge: 65,
      colaWithInflation: false,
    },
  ],
});
const coveredRows = computeRetirementProjections(covered, { currentYear: CURRENT_YEAR });
assert(coveredRows[0].portfolioWithdrawal === 0, "income above spend draws $0");
assert(
  Math.round(coveredRows[0].closingBalance) === 100_000,
  "portfolio is untouched when income covers spend",
);

const delayed = plan({
  currentAge: 60,
  retirementAge: 60,
  retirementYear: CURRENT_YEAR,
  planEndAge: 66,
  annualLifestyleSpending: 10_000,
  incomeStreams: [
    {
      id: "cpp",
      name: "CPP",
      kind: "cpp",
      annualAmount: 6_000,
      startAge: 65,
      colaWithInflation: false,
    },
  ],
});
const delayedRows = computeRetirementProjections(delayed, { currentYear: CURRENT_YEAR });
assert(delayedRows[0].income === 0, "income is 0 before start age");
assert(delayedRows[0].portfolioWithdrawal === 10_000, "full spend is withdrawn before CPP");
const at65 = delayedRows.find((row) => row.age === 65);
assert(at65?.income === 6_000, "CPP starts at the configured age");
assert(at65?.portfolioWithdrawal === 4_000, "withdrawal drops once CPP starts");

// --- Depletion year -------------------------------------------------------

const burns = plan({
  currentAge: 65,
  retirementAge: 65,
  retirementYear: CURRENT_YEAR,
  planEndAge: 75,
  annualLifestyleSpending: 50_000,
});
const burnRows = computeRetirementProjections(burns, { currentYear: CURRENT_YEAR });
assert(findDepletionYear(burnRows) === CURRENT_YEAR + 1, "depletes the year the pot hits $0");
assert(findDepletionAge(burnRows) === 66, "depletion age is 66");

const lasts = plan({
  currentAge: 65,
  retirementAge: 65,
  retirementYear: CURRENT_YEAR,
  planEndAge: 70,
  annualLifestyleSpending: 5_000,
});
const lastRows = computeRetirementProjections(lasts, { currentYear: CURRENT_YEAR });
assert(findDepletionYear(lastRows) === null, "small spend lasts past plan end");
assert(nestEggAtRetirement(lastRows, CURRENT_YEAR) === lastRows[0].closingBalance, "nest egg at retirement year");

const emptyDash = computeRetirementDashboard(plan({ assets: [] }), {
  currentYear: CURRENT_YEAR,
});
assert(emptyDash.verdict === "empty", "no assets is an empty verdict");
assert(verdictFromGap(1_600_000, 1_500_000) === "on-track", "5%+ over target is on track");
assert(verdictFromGap(1_800_000, 1_500_000) === "ahead", "10%+ over target is ahead");
assert(verdictFromGap(1_000_000, 1_500_000) === "behind", "under 95% of target is behind");

// --- Monte Carlo success definition ---------------------------------------

assert(DEFAULT_VOLATILITY_BY_TYPE.stock === 15, "stock vol assumption is 15%");
assert(DEFAULT_VOLATILITY_BY_TYPE.crypto === 50, "crypto vol assumption is 50%");
assert(DEFAULT_VOLATILITY_BY_TYPE.cash === 1, "cash vol assumption is 1%");
assert(DEFAULT_VOLATILITY_BY_TYPE.custom === 10, "custom vol assumption is 10%");

const sureFail = plan({
  currentAge: 65,
  retirementAge: 65,
  retirementYear: CURRENT_YEAR,
  planEndAge: 70,
  annualLifestyleSpending: 1_000_000,
  assets: [
    asset({
      id: "tiny",
      symbol: "CASH",
      unitPrice: 1,
      quantity: 1_000,
      expectedCagr: 0,
      type: "cash",
    }),
  ],
});
const failRows = computeRetirementProjections(sureFail, { currentYear: CURRENT_YEAR });
assert(isSuccessfulPath(failRows) === false, "success requires portfolio > 0 at plan end");
const failMc = runRetirementMonteCarlo(sureFail, {
  currentYear: CURRENT_YEAR,
  paths: 80,
  seed: 11,
});
assert(failMc.successRate === 0, "paths that hit $0 at plan end are failures");
assert(failMc.successCount === 0, "success count is 0 when every path depletes");

const sureWin = plan({
  currentAge: 65,
  retirementAge: 65,
  retirementYear: CURRENT_YEAR,
  planEndAge: 68,
  annualLifestyleSpending: 0,
  assets: [
    asset({
      id: "fat",
      symbol: "CASH",
      unitPrice: 1,
      quantity: 200_000,
      expectedCagr: 0,
      type: "cash",
    }),
  ],
});
const winRows = computeRetirementProjections(sureWin, { currentYear: CURRENT_YEAR });
assert(isSuccessfulPath(winRows) === true, "positive end balance is a success");
const winMc = runRetirementMonteCarlo(sureWin, {
  currentYear: CURRENT_YEAR,
  paths: 80,
  seed: 11,
});
assert(winMc.successRate === 1, "no-spend cash plan succeeds on every path");

const emptyMc = runRetirementMonteCarlo(plan({ assets: [] }), {
  currentYear: CURRENT_YEAR,
  paths: 20,
  seed: 1,
});
assert(emptyMc.successRate === 0, "no assets cannot succeed");

// --- Plan migrate of old documents ----------------------------------------

const legacyAssets = [
  {
    id: "voo",
    symbol: "VOO",
    name: "S&P 500",
    type: "stock",
    unitPrice: 500,
    quantity: 10,
    expectedCagr: 7,
  },
];
const legacy = normalizeRetirementPlan(
  {
    id: "legacy-1",
    name: "Pre-horizon plan",
    retirementYear: CURRENT_YEAR + 20,
    annualLifestyleSpending: 60_000,
    inflationRate: 3,
    priceProjectionScenario: "expected",
    assets: legacyAssets,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
  },
  { currentYear: CURRENT_YEAR },
);

assert(legacy.id === "legacy-1", "migrate keeps plan id");
assert(legacy.name === "Pre-horizon plan", "migrate keeps name");
assert(legacy.assets.length === 1, "migrate keeps assets (no invented balances)");
assert(legacy.assets[0].symbol === "VOO", "migrate keeps symbol");
assert(legacy.assets[0].quantity === 10, "migrate keeps quantity");
assert(legacy.assets[0].unitPrice === 500, "migrate keeps unit price");
assert(legacy.assets[0].expectedCagr === 7, "migrate keeps custom CAGR");
assert(legacy.currentAge === DEFAULT_CURRENT_AGE, "missing currentAge defaults to 40");
assert(legacy.retirementAge === 60, "retirementAge is derived from the saved year");
assert(legacy.retirementYear === CURRENT_YEAR + 20, "retirementYear is preserved");
assert(legacy.planEndAge === DEFAULT_PLAN_END_AGE, "plan end age defaults to 90");
assert(legacy.currency === DEFAULT_PLAN_CURRENCY, "display currency defaults to CAD");
assert(legacy.withdrawalRate === 4, "withdrawal rate defaults to 4%");
assert(legacy.annualContribution === 0, "contribution defaults to 0");
assert(legacy.incomeStreams.length === 0, "income streams default to none");
assert(legacy.spouse === null, "spouse stays absent");
assert(legacy.annualLifestyleSpending === 60_000, "spending is unchanged");

const withAge = normalizeRetirementPlan(
  {
    id: "kept-age",
    name: "Has age",
    retirementYear: CURRENT_YEAR + 10,
    annualLifestyleSpending: 50_000,
    inflationRate: 2,
    priceProjectionScenario: "expected",
    assets: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    currentAge: 51,
    retirementAge: 61,
  },
  { currentYear: CURRENT_YEAR },
);
assert(withAge.currentAge === 51, "explicit currentAge is kept");
assert(withAge.retirementAge === 61, "explicit retirementAge is kept");
assert(
  withAge.retirementYear === CURRENT_YEAR + 10,
  "explicit ages re-sync retirementYear",
);

const again = normalizeRetirementPlan(legacy, { currentYear: CURRENT_YEAR });
assert(again.assets[0].quantity === 10, "re-normalize does not invent or drop balances");
assert(again.currentAge === 40, "re-normalize keeps the filled currentAge");

// --- Refresh from portfolio preserves CAGR --------------------------------

const refreshed = refreshAssetsFromPortfolio(
  [
    asset({
      id: "keep-cagr",
      symbol: "VOO",
      name: "Old name",
      type: "stock",
      unitPrice: 400,
      quantity: 2,
      expectedCagr: 9.5,
    }),
    asset({
      id: "custom-keep",
      symbol: "CABIN",
      name: "Cottage",
      type: "custom",
      unitPrice: 80_000,
      quantity: 1,
      expectedCagr: 3,
    }),
  ],
  [
    {
      id: "h1",
      symbol: "VOO",
      name: "Vanguard S&P",
      type: "stock",
      sector: "US",
      category: "US",
      subCategory: "Equity",
      costPrice: 400,
      quantity: 12,
      addedAt: "2024-01-01T00:00:00.000Z",
      transactions: [],
    } satisfies PortfolioHolding,
  ],
  { VOO: 520 },
);
assert(refreshed[0].quantity === 12, "refresh updates matched quantity");
assert(refreshed[0].unitPrice === 520, "refresh updates matched live price");
assert(refreshed[0].expectedCagr === 9.5, "refresh keeps custom CAGR");
assert(refreshed[1].symbol === "CABIN", "refresh keeps unmatched custom assets");
assert(refreshed[1].quantity === 1, "unmatched custom quantity is unchanged");
assert(refreshed.length === 2, "refresh does not add new holdings");

// --- What-if patches ------------------------------------------------------

assert(defaultExtraAnnualSavings(0) === 6_000, "zero contribution suggests +$6k");
assert(defaultExtraAnnualSavings(10_000) === 2_500, "25% extra on $10k rounds to $2,500");
const scenarios = buildWhatIfScenarios(plan({ retirementAge: 65, annualLifestyleSpending: 100_000 }));
const later = scenarios.find((item) => item.id === "retire-later");
const earlier = scenarios.find((item) => item.id === "retire-earlier");
const lean = scenarios.find((item) => item.id === "spend-less");
const richer = scenarios.find((item) => item.id === "spend-more");
assert(later?.patch.retirementAge === 67, "retire-later adds 2 years");
assert(earlier?.patch.retirementAge === 63, "retire-earlier subtracts 2 years");
assert(lean?.patch.annualLifestyleSpending === 90_000, "spend-less is 10%");
assert(richer?.patch.annualLifestyleSpending === 110_000, "spend-more is 10%");
const applied = applyScenario(plan({ retirementAge: 65 }), later!, CURRENT_YEAR);
assert(applied.retirementAge === 67, "applying a scenario updates the base ages");
assert(applied.retirementYear === CURRENT_YEAR + 27, "applying retire-later syncs the year");

const emptyPath = impliedPathSentence(emptyDash, (value) => `$${value}`);
assert(
  emptyPath.includes("Refresh from the book") || emptyPath.includes("add assets"),
  "empty path does not invent a CAGR",
);
const behindDash = computeRetirementDashboard(
  plan({
    currentAge: 40,
    retirementAge: 65,
    retirementYear: CURRENT_YEAR + 25,
    annualLifestyleSpending: 80_000,
    assets: [
      asset({
        id: "a1",
        symbol: "CASH",
        unitPrice: 1,
        quantity: 10_000,
        expectedCagr: 0,
        type: "cash",
      }),
    ],
  }),
  { currentYear: CURRENT_YEAR },
);
assert(behindDash.verdict === "behind", "tiny pot vs 4% target is behind");
assert(behindDash.yearsToRetirement === 25, "years left comes from the plan ages");
assert(behindDash.gapToday != null && behindDash.gapToday < 0, "gap today is already computed");
const path = impliedPathSentence(behindDash, (value) => `$${Math.round(value)}`);
assert(path.includes("25 years left"), "path sentence uses years left");
assert(path.includes("short today"), "path sentence uses the existing gap");
assert(!/cagr/i.test(path), "path sentence does not invent a CAGR");
const lever = whatIfLeverSentence(
  plan({ retirementAge: 65, annualLifestyleSpending: 100_000, annualContribution: 0 }),
);
assert(lever.includes("Retire 2 years later"), "lever uses existing retire-later copy");
assert(lever.includes("Retire 2 years earlier"), "lever uses retire-earlier copy");
assert(lever.includes("Spend 10% less"), "lever uses existing spend-less copy");
assert(lever.includes("Save $6,000 more / year"), "lever uses existing save-more copy");

const compared = compareRetirementScenarios(sureWin, {
  currentYear: CURRENT_YEAR,
  paths: 40,
  seed: 11,
  includeBase: false,
});
assert(
  compared.every((item) => item.typicalAgeLabel != null),
  "what-if typical market age comes from the existing sim",
);
assert(
  compared.every((item) => item.typicalLastsToTarget === true),
  "no-spend cash what-ifs last in a typical market",
);

// --- Outlook copy from existing p10 / p50 / p90 ----------------------------

function fakeBands(
  rows: Array<{ age: number; p10: number; p50: number; p90: number }>,
): MonteCarloPercentileBand[] {
  return rows.map((row, index) => ({
    year: CURRENT_YEAR + index,
    ...row,
  }));
}

function fakeResult(bands: MonteCarloPercentileBand[]): MonteCarloResult {
  return {
    paths: 750,
    successCount: 0,
    successRate: 0,
    percentiles: bands,
  };
}

assert(
  outlookSentence(null, 90) === "Add holdings to see how long this plan lasts.",
  "empty outlook does not invent a lasting age",
);

const depletes = outlookLivesFromResult(
  fakeResult(
    fakeBands([
      { age: 65, p10: 80_000, p50: 90_000, p90: 110_000 },
      { age: 72, p10: 0, p50: 40_000, p90: 90_000 },
      { age: 81, p10: 0, p50: 0, p90: 20_000 },
      { age: 90, p10: 0, p50: 0, p90: 0 },
    ]),
  ),
  90,
);
assert(depletes?.bad.depletionAge === 72, "bad life maps to p10 depletion age");
assert(depletes?.typical.depletionAge === 81, "typical life maps to p50 depletion age");
assert(depletes?.good.depletionAge === 90, "good life maps to p90 depletion age");
assert(
  outlookSentence(depletes, 90) ===
    "In a typical market this plan lasts to age 81. In a bad one it runs out at age 72. You need it to 90.",
  "sentence uses typical and bad ages, not a score",
);
assert(!/monte carlo|percentile|sigma|p10|p50|p90|1,000 runs|simulation/i.test(outlookSentence(depletes, 90)), "default sentence stays in plain English");

const typicalLasts = outlookLivesFromResult(
  fakeResult(
    fakeBands([
      { age: 65, p10: 50_000, p50: 120_000, p90: 180_000 },
      { age: 80, p10: 0, p50: 60_000, p90: 140_000 },
      { age: 90, p10: 0, p50: 15_000, p90: 90_000 },
    ]),
  ),
  90,
);
assert(typicalLasts?.typical.lastsToTarget === true, "p50 still positive at target lasts");
assert(typicalLasts?.bad.lastsToTarget === false, "p10 hitting $0 before target does not last");
assert(
  outlookSentence(typicalLasts, 90) === "This plan lasts in a typical market.",
  "typical-lasts sentence matches the product copy",
);
assert(formatOutlookAge(typicalLasts!.bad, 90) === "80", "bad age is the p10 run-out");
assert(formatOutlookAge(typicalLasts!.typical, 90) === "Past 90", "typical life that lasts is Past target");

const evenBadLasts = outlookLivesFromResult(
  fakeResult(
    fakeBands([
      { age: 65, p10: 80_000, p50: 120_000, p90: 160_000 },
      { age: 90, p10: 12_000, p50: 40_000, p90: 80_000 },
    ]),
  ),
  90,
);
assert(
  outlookSentence(evenBadLasts, 90) === "This plan lasts even when markets are bad.",
  "p10 lasting to target uses the stronger sentence",
);

const chartRows = outlookChartRows(
  fakeBands([{ age: 70, p10: 10, p50: 20, p90: 40 }]),
);
assert(chartRows[0]?.bad === 10 && chartRows[0]?.typical === 20 && chartRows[0]?.good === 40, "chart rows are the existing three lives");
assert(chartRows[0]?.spread === 30, "band width is p90 minus p10");

const projectionRows = buildProjectionChartData(
  winRows,
  sureWin.assets,
  winMc.percentiles,
);
assert(
  projectionRows.some(
    (row) => row.typical != null && row.typical === row.p50 && row.bad === row.p10,
  ),
  "Total chart maps p50 to Typical instead of leaving it unused",
);

const nudged = nudgeRetirementAge(plan({ retirementAge: 65 }), 1, CURRENT_YEAR);
assert(nudged.retirementAge === 66, "retire later is +1 year");
assert(nudged.retirementYear === CURRENT_YEAR + 26, "retire later keeps the year in sync");
const alreadyRetired = nudgeRetirementAge(plan({ currentAge: 40, retirementAge: 40 }), -1, CURRENT_YEAR);
assert(alreadyRetired.retirementAge === 40, "cannot retire earlier than current age");
assert(nudgeAnnualSpending(plan({ annualLifestyleSpending: 100_000 }), -1).annualLifestyleSpending === 90_000, "spend less is 10%");
assert(nudgeAnnualSpending(plan({ annualLifestyleSpending: 100_000 }), 1).annualLifestyleSpending === 110_000, "spend more is 10%");
assert(nudgeAnnualSavings(plan({ annualContribution: 0 }), 1).annualContribution === 6_000, "save more uses the existing extra step");
assert(nudgeAnnualSavings(plan({ annualContribution: 1_000 }), -1, CURRENT_YEAR, 6_000).annualContribution === 0, "save less does not go negative");

const winOutlook = outlookLivesFromResult(winMc, 68);
assert(winOutlook?.typical.lastsPastEnd === true, "no-spend cash sim still lasts on the typical life");
assert(outlookSentence(winOutlook, 68) === "This plan lasts even when markets are bad.", "same sim, human sentence when every life lasts");

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

console.log("\nAll retire unit tests passed");
