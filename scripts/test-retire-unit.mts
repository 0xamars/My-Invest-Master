/**
 * Retirement planner math: target nest egg, contributions, income,
 * depletion, Monte Carlo success, and old-document migrate.
 *   npx tsx --tsconfig tsconfig.json scripts/test-retire-unit.mts
 */
import { computeRetirementDashboard, verdictFromGap } from "../src/lib/retirement/dashboard.ts";
import { isSuccessfulPath, runRetirementMonteCarlo } from "../src/lib/retirement/monte-carlo.ts";
import { normalizeRetirementPlan } from "../src/lib/retirement/normalize.ts";
import { refreshAssetsFromPortfolio } from "../src/lib/retirement/portfolio-import.ts";
import {
  computeRetirementProjections,
  findDepletionAge,
  findDepletionYear,
  nestEggAtRetirement,
} from "../src/lib/retirement/projections.ts";
import {
  applyScenario,
  buildWhatIfScenarios,
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
const lean = scenarios.find((item) => item.id === "spend-less");
assert(later?.patch.retirementAge === 67, "retire-later adds 2 years");
assert(lean?.patch.annualLifestyleSpending === 90_000, "spend-less is 10%");
const applied = applyScenario(plan({ retirementAge: 65 }), later!, CURRENT_YEAR);
assert(applied.retirementAge === 67, "applying a scenario updates the base ages");
assert(applied.retirementYear === CURRENT_YEAR + 27, "applying retire-later syncs the year");

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

console.log("\nAll retire unit tests passed");
