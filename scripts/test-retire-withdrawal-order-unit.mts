/**
 * Withdrawal-order comparison and the 2026 federal + Ontario tax estimate.
 *   npx tsx --tsconfig tsconfig.json scripts/test-retire-withdrawal-order-unit.mts
 *
 * The golden couple is fictional. None of these balances are a real household.
 */
import {
  estimatePersonTax,
  ontarioHealthPremium,
  taxTableForYear,
} from "../src/lib/retirement/tax-ca.ts";
import { normalizeRetirementPlan } from "../src/lib/retirement/normalize.ts";
import {
  EXAMPLE_CAD_PER_USD,
  EXAMPLE_COUPLE_PLAN,
  EXAMPLE_COUPLE_YEAR,
} from "../src/lib/retirement/example-couple.ts";
import {
  compareWithdrawalOrders,
  createWithdrawalOrderEngine,
  FUNDING_SHORTFALL_TOLERANCE,
  sharedTaxComparison,
  type WithdrawalOrderComparison,
  type WithdrawalOrderEngineAssumptions,
} from "../src/lib/retirement/withdrawal-orders.ts";
import type {
  RetirementPlan,
  RetirementPlanAsset,
  WithdrawalOrderId,
} from "../src/types/retirement.ts";
import type { WithdrawalYearInput } from "../src/lib/retirement/withdrawal.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

function near(actual: number, expected: number, msg: string, tolerance = 1) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${msg} (got ${actual}, expected ${expected})`,
  );
}

const YEAR = 2026;
const ORDERS: WithdrawalOrderId[] = [
  "rrsp-first",
  "tfsa-last",
  "non-registered-first",
  "meltdown",
];

function asset(
  partial: Pick<RetirementPlanAsset, "id" | "symbol" | "unitPrice" | "quantity"> &
    Partial<RetirementPlanAsset>,
): RetirementPlanAsset {
  return {
    name: partial.symbol,
    type: "custom",
    expectedCagr: 0,
    accountKind: "non_registered",
    owner: "person1",
    annualContribution: 0,
    ...partial,
  };
}

function people(): WithdrawalYearInput["people"] {
  return [
    {
      id: "person1",
      age: 65,
      retired: true,
      deceased: false,
      cpp: 10_000,
      oas: 8_500,
      pension: 0,
      pensionAfterSplit: 0,
      other: 0,
    },
    {
      id: "person2",
      age: 63,
      retired: true,
      deceased: false,
      cpp: 6_000,
      oas: 0,
      pension: 0,
      pensionAfterSplit: 0,
      other: 0,
    },
  ];
}

function coupleAccounts(): WithdrawalYearInput["accounts"] {
  return [
    {
      id: "rrsp-1",
      owner: "person1",
      kind: "rrsp",
      value: 400_000,
      contribution: 0,
      rrifMinimum: 0,
    },
    {
      id: "rrsp-2",
      owner: "person2",
      kind: "rrsp",
      value: 150_000,
      contribution: 0,
      rrifMinimum: 0,
    },
    {
      id: "tfsa-1",
      owner: "person1",
      kind: "tfsa",
      value: 100_000,
      contribution: 0,
      rrifMinimum: 0,
    },
    {
      id: "tfsa-2",
      owner: "person2",
      kind: "tfsa",
      value: 80_000,
      contribution: 0,
      rrifMinimum: 0,
    },
    {
      id: "taxable-1",
      owner: "person1",
      kind: "non_registered",
      value: 50_000,
      contribution: 0,
      rrifMinimum: 0,
    },
  ];
}

const engineAssumptions = (
  patch: Partial<WithdrawalOrderEngineAssumptions> = {},
): WithdrawalOrderEngineAssumptions => ({
  unrealizedGainShare: 0,
  capitalGainsInclusionRate: 0.5,
  meltdownTargetIncome: 58_523,
  annualTfsaRoom: 7_000,
  pensionSplitPercent: 0,
  ...patch,
});

function taken(
  order: WithdrawalOrderId,
  gap: number,
  patch: Partial<WithdrawalOrderEngineAssumptions> = {},
) {
  const engine = createWithdrawalOrderEngine(order, engineAssumptions(patch));
  return engine({
    spendingGap: gap,
    people: people(),
    accounts: coupleAccounts(),
  });
}

// --- Draw sequence ---------------------------------------------------------
// Person 2's taxable income starts at $6,000 and person 1's at $18,500.
// RRSP withdrawals are fully taxable, so person 2 is drawn only until the
// incomes match ($12,500), then the remaining $33,000 is split equally.

const rrspFirst = taken("rrsp-first", 45_500);
assert(rrspFirst.withdrawalByAccount["rrsp-2"] === 29_000, "RRSP first draws person 2 up to a matched income, then half");
assert(rrspFirst.withdrawalByAccount["rrsp-1"] === 16_500, "RRSP first draws the matched half from person 1");
assert((rrspFirst.withdrawalByAccount["taxable-1"] ?? 0) === 0, "RRSP first does not touch non-registered yet");
assert((rrspFirst.withdrawalByAccount["tfsa-1"] ?? 0) === 0, "RRSP first does not touch TFSA yet");

const tfsaLast = taken("tfsa-last", 45_500);
assert(tfsaLast.withdrawalByAccount["taxable-1"] === 45_500, "TFSA last draws non-registered first");
assert((tfsaLast.withdrawalByAccount["rrsp-1"] ?? 0) === 0, "TFSA last does not draw RRSP while non-registered covers the gap");
assert((tfsaLast.withdrawalByAccount["tfsa-2"] ?? 0) === 0, "TFSA last does not draw TFSA while non-registered covers the gap");

const nonRegFirst = taken("non-registered-first", 45_500);
assert(
  nonRegFirst.withdrawalByAccount["taxable-1"] === 45_500,
  "non-registered first also starts with the taxable account",
);

const wide = 120_000;
const tfsaLastWide = taken("tfsa-last", wide);
assert(tfsaLastWide.withdrawalByAccount["taxable-1"] === 50_000, "TFSA last exhausts non-registered");
// Remaining $70,000 is RRSP. Person 2 catches up by $12,500, then each takes $28,750.
assert(tfsaLastWide.withdrawalByAccount["rrsp-2"] === 41_250, "TFSA last then matches incomes and splits the RRSP");
assert(tfsaLastWide.withdrawalByAccount["rrsp-1"] === 28_750, "TFSA last draws person 1's matched RRSP share");
assert((tfsaLastWide.withdrawalByAccount["tfsa-1"] ?? 0) === 0, "TFSA last still has not touched TFSA");

const nonRegWide = taken("non-registered-first", wide);
assert(nonRegWide.withdrawalByAccount["taxable-1"] === 50_000, "non-registered first exhausts non-registered");
assert(nonRegWide.withdrawalByAccount["tfsa-2"] === 70_000, "non-registered first then draws the lower-income TFSA");
assert((nonRegWide.withdrawalByAccount["rrsp-2"] ?? 0) === 0, "non-registered first does not draw RRSP while TFSA covers the rest");

const meltdown = taken("meltdown", 45_500);
// Targets: person 1 needs 58,523 − 18,500 = 40,023. Person 2 needs 58,523 − 6,000 = 52,523.
assert(meltdown.withdrawalByAccount["rrsp-1"] === 40_023, "meltdown fills person 1 up to the target");
assert(meltdown.withdrawalByAccount["rrsp-2"] === 52_523, "meltdown fills person 2 up to the target");
assert((meltdown.withdrawalByAccount["taxable-1"] ?? 0) === 0, "meltdown does not need non-registered once the target draws cover the gap");
// Gross registered draw 92,546 − gap 45,500 = 47,046 surplus.
// TFSA room 7,000 per person = 14,000, and the rest 33,046 returns to non-registered.
near(meltdown.closingByAccount["tfsa-1"], 107_000, "meltdown surplus fills person 1 TFSA room");
near(meltdown.closingByAccount["tfsa-2"], 87_000, "meltdown surplus fills person 2 TFSA room");
near(meltdown.closingByAccount["taxable-1"], 83_046, "meltdown surplus above TFSA room returns to non-registered");

const capped = taken("meltdown", 10_000, { meltdownTargetIncome: 18_500 });
assert((capped.withdrawalByAccount["rrsp-1"] ?? 0) === 0, "meltdown does not draw once person 1 is already at the target");
assert(capped.withdrawalByAccount["rrsp-2"] === 12_500, "meltdown draws person 2 only up to the target");

// The bracket target is a preference. Once TFSA and non-registered are gone,
// remaining RRSP and RRIF still fund the spending gap.
const forced = createWithdrawalOrderEngine(
  "meltdown",
  engineAssumptions({ meltdownTargetIncome: 20_000, annualTfsaRoom: 0 }),
)({
  spendingGap: 80_000,
  people: people(),
  accounts: [
    {
      id: "rrsp-1",
      owner: "person1",
      kind: "rrsp",
      value: 200_000,
      contribution: 0,
      rrifMinimum: 0,
    },
    {
      id: "tfsa-1",
      owner: "person1",
      kind: "tfsa",
      value: 5_000,
      contribution: 0,
      rrifMinimum: 0,
    },
    {
      id: "taxable-1",
      owner: "person1",
      kind: "non_registered",
      value: 5_000,
      contribution: 0,
      rrifMinimum: 0,
    },
  ],
});
const forcedDrawn =
  (forced.withdrawalByAccount["rrsp-1"] ?? 0) +
  (forced.withdrawalByAccount["tfsa-1"] ?? 0) +
  (forced.withdrawalByAccount["taxable-1"] ?? 0) -
  forced.rrifSurplusReinvested;
assert(forced.withdrawalByAccount["tfsa-1"] === 5_000, "meltdown uses the TFSA when the target draw cannot fund the gap");
assert(forced.withdrawalByAccount["taxable-1"] === 5_000, "meltdown uses non-registered when the target draw cannot fund the gap");
assert(
  (forced.withdrawalByAccount["rrsp-1"] ?? 0) > 20_000 - 18_500,
  "meltdown draws RRSP above the target when spending is still short",
);
near(forcedDrawn, 80_000, "meltdown funds the full gap once extra RRSP is drawn", 0.01);

// --- RRIF minimum is always taken ------------------------------------------

for (const order of ORDERS) {
  const engine = createWithdrawalOrderEngine(
    order,
    engineAssumptions({ meltdownTargetIncome: 0 }),
  );
  const result = engine({
    spendingGap: 0,
    people: [
      {
        id: "person1",
        age: 72,
        retired: true,
        deceased: false,
        cpp: 0,
        oas: 0,
        pension: 0,
        pensionAfterSplit: 0,
        other: 0,
      },
    ],
    accounts: [
      {
        id: "rrif",
        owner: "person1",
        kind: "rrif",
        value: 100_000,
        contribution: 0,
        rrifMinimum: 5_400,
      },
      {
        id: "cash",
        owner: "person1",
        kind: "cash",
        value: 1_000,
        contribution: 0,
        rrifMinimum: 0,
      },
    ],
  });
  assert(result.rrifMinimum === 5_400, `${order} takes the RRIF minimum when spending is zero`);
  assert(result.withdrawalByAccount.rrif === 5_400, `${order} records the RRIF minimum as a withdrawal`);
  assert(result.closingByAccount.rrif === 94_600, `${order} reduces the RRIF by the minimum`);
}

// --- OAS clawback ----------------------------------------------------------

const below = estimatePersonTax({
  age: 65,
  netIncomeBeforeClawback: 90_000,
  oas: 8_500,
  eligiblePension: 0,
});
assert(below.oasClawback === 0, "OAS clawback is zero below the 2026 threshold of $95,323");

// 100,000 − 95,323 = 4,677. 15% × 4,677 = 701.55, and that is under the $8,500 OAS.
const above = estimatePersonTax({
  age: 65,
  netIncomeBeforeClawback: 100_000,
  oas: 8_500,
  eligiblePension: 0,
});
near(above.oasClawback, 701.55, "OAS clawback is 15% of income above $95,323");

// 15% × (250,000 − 95,323) = 23,201.55, which is above the $8,500 OAS, so the clawback caps.
const cappedClawback = estimatePersonTax({
  age: 65,
  netIncomeBeforeClawback: 250_000,
  oas: 8_500,
  eligiblePension: 0,
});
assert(
  cappedClawback.oasClawback === 8_500,
  "OAS clawback is capped at the OAS received",
);

function oasPlan(cpp: number): RetirementPlan {
  return normalizeRetirementPlan(
    {
      id: "oas",
      name: "Fictional OAS",
      currentAge: 65,
      retirementAge: 65,
      retirementYear: YEAR,
      planEndAge: 65,
      inflationRate: 0,
      annualLifestyleSpending: 1,
      pensionSplitPercent: 0,
      assets: [
        asset({
          id: "cash",
          symbol: "CASH",
          type: "cash",
          unitPrice: 1,
          quantity: 1,
          accountKind: "cash",
        }),
      ],
      incomeStreams: [
        {
          id: "cpp",
          name: "CPP",
          kind: "cpp",
          annualAmount: cpp,
          startAge: 65,
          colaWithInflation: false,
          owner: "person1",
          survivorPercent: 0,
        },
        {
          id: "oas",
          name: "OAS",
          kind: "oas",
          annualAmount: 8_500,
          startAge: 65,
          colaWithInflation: false,
          owner: "person1",
          survivorPercent: 0,
        },
      ],
      withdrawalAssumptions: {
        selectedOrder: "rrsp-first",
        unrealizedGainShare: 0,
        capitalGainsInclusionRate: 0.5,
        meltdownTargetIncome: null,
        annualTfsaRoom: null,
      },
    },
    { currentYear: YEAR },
  );
}

const oasHigh = compareWithdrawalOrders(oasPlan(100_000), {
  currentYear: YEAR,
  cadPerUsd: 1,
});
const oasLow = compareWithdrawalOrders(oasPlan(80_000), {
  currentYear: YEAR,
  cadPerUsd: 1,
});
near(
  oasHigh.orders[0].rowsByPerson.person1[0].oasClawback,
  1_976.55,
  "the comparison claws back OAS when CPP plus OAS is $108,500",
);
assert(
  oasLow.orders[0].rowsByPerson.person1[0].oasClawback === 0,
  "the comparison claws back nothing when CPP plus OAS is $88,500",
);

// --- Golden couple, first year, RRSP first ---------------------------------
// Fictional: person 1 age 65, person 2 age 63, both retired, Ontario, 0% growth,
// 0% inflation. RRSP 400,000 / 150,000, TFSA 100,000 / 80,000, non-registered
// 50,000 / 0. Spending 70,000. CPP 10,000 / 6,000. OAS 8,500 at 65, so person 2
// has no OAS yet. Unrealized gain share is 0 so the non-registered account is
// not in this year's tax. Pension split is 0. cadPerUsd is 1 so the published
// 2026 dollar figures apply directly.
//
// Other income: person 1 = 10,000 + 8,500 = 18,500. Person 2 = 6,000.
// Gap before tax = 70,000 − 24,500 = 45,500.
// RRSP withdrawals are fully taxable and the pension split is 0, so person 2
// is drawn only until taxable income matches person 1, then each takes the
// same additional RRSP dollar S.
//   Catch-up = 18,500 − 6,000 = 12,500
//   Person 2 RRSP = 12,500 + S, person 1 RRSP = S
//   Both taxable incomes N = 18,500 + S
//   W = 12,500 + 2S = 2N − 24,500
//   W = 45,500 + T1 + T2
//   2N = 70,000 + T1 + T2
//
// N lands at $39,142.78: first federal bracket, first Ontario bracket, full
// age amounts (thresholds $46,432 and $47,210), health premium flat at $450
// (the $450 cap starts at $38,500), no surtax, and Ontario basic tax above
// the $600 low-income reduction cutoff for both people. Clawback is zero.
//
// Person 1, age 65, OAS included in the $18,500, no pension credit on RRSP:
//   federal = 0.14 N − 0.14 × (16,452 + 9,208) = 0.14 N − 3,592.40
//   Ontario = 0.0505 N − 0.0505 × (12,989 + 6,342) + 450 = 0.0505 N − 526.2155
//   T1 = 0.1905 N − 4,118.6155
// Person 2, age 63, no age amount and no OAS:
//   federal = 0.14 N − 0.14 × 16,452 = 0.14 N − 2,303.28
//   Ontario = 0.0505 N − 0.0505 × 12,989 + 450 = 0.0505 N − 205.9445
//   T2 = 0.1905 N − 2,509.2245
//   T1 + T2 = 0.381 N − 6,627.84
//   2N = 70,000 + 0.381 N − 6,627.84 = 63,372.16 + 0.381 N
//   N = 63,372.16 / 1.619 = 39,142.7795
//   S = 20,642.7795
//   Person 1 RRSP = 20,642.78, federal = 1,887.59, Ontario = 1,450.49, tax = 3,338.08
//   Person 2 RRSP = 33,142.78, federal = 3,176.71, Ontario = 1,770.77, tax = 4,947.47

const golden = normalizeRetirementPlan(
  {
    id: "golden-couple",
    name: "Fictional couple",
    currentAge: 65,
    retirementAge: 65,
    retirementYear: YEAR,
    planEndAge: 67,
    inflationRate: 0,
    annualLifestyleSpending: 70_000,
    pensionSplitPercent: 0,
    spouse: { name: "Riley", currentAge: 63, retirementAge: 63 },
    assets: [
      asset({
        id: "rrsp-1",
        symbol: "RRSP1",
        unitPrice: 400_000,
        quantity: 1,
        accountKind: "rrsp",
        owner: "person1",
      }),
      asset({
        id: "rrsp-2",
        symbol: "RRSP2",
        unitPrice: 150_000,
        quantity: 1,
        accountKind: "rrsp",
        owner: "person2",
      }),
      asset({
        id: "tfsa-1",
        symbol: "TFSA1",
        unitPrice: 100_000,
        quantity: 1,
        accountKind: "tfsa",
        owner: "person1",
      }),
      asset({
        id: "tfsa-2",
        symbol: "TFSA2",
        unitPrice: 80_000,
        quantity: 1,
        accountKind: "tfsa",
        owner: "person2",
      }),
      asset({
        id: "taxable-1",
        symbol: "TAX1",
        unitPrice: 50_000,
        quantity: 1,
        accountKind: "non_registered",
        owner: "person1",
      }),
    ],
    incomeStreams: [
      {
        id: "cpp-1",
        name: "CPP",
        kind: "cpp",
        annualAmount: 10_000,
        startAge: 65,
        colaWithInflation: false,
        owner: "person1",
        survivorPercent: 0,
      },
      {
        id: "cpp-2",
        name: "CPP",
        kind: "cpp",
        annualAmount: 6_000,
        startAge: 63,
        colaWithInflation: false,
        owner: "person2",
        survivorPercent: 0,
      },
      {
        id: "oas-1",
        name: "OAS",
        kind: "oas",
        annualAmount: 8_500,
        startAge: 65,
        colaWithInflation: false,
        owner: "person1",
        survivorPercent: 0,
      },
      {
        id: "oas-2",
        name: "OAS",
        kind: "oas",
        annualAmount: 8_500,
        startAge: 65,
        colaWithInflation: false,
        owner: "person2",
        survivorPercent: 0,
      },
    ],
    withdrawalAssumptions: {
      selectedOrder: "rrsp-first",
      unrealizedGainShare: 0,
      capitalGainsInclusionRate: 0.5,
      meltdownTargetIncome: 58_523,
      annualTfsaRoom: 7_000,
    },
  },
  { currentYear: YEAR },
);

const compared = compareWithdrawalOrders(golden, { currentYear: YEAR, cadPerUsd: 1 });
const again = compareWithdrawalOrders(golden, { currentYear: YEAR, cadPerUsd: 1 });
assert(
  JSON.stringify(compared) === JSON.stringify(again),
  "the same plan returns the same comparison",
);

const rrspOrder = compared.orders.find((order) => order.id === "rrsp-first");
assert(rrspOrder != null, "RRSP first is in the comparison");
const yearOneYou = rrspOrder?.rowsByPerson.person1[0];
const yearOneSpouse = rrspOrder?.rowsByPerson.person2[0];
assert(yearOneYou != null && yearOneSpouse != null, "both people have a first year");

if (yearOneYou && yearOneSpouse) {
  assert(yearOneYou.age === 65 && yearOneYou.alive, "person 1 is 65 and alive");
  assert(yearOneSpouse.age === 63 && yearOneSpouse.alive, "person 2 is 63 and alive");
  near(yearOneYou.withdrawals.rrspRrif, 20_642.78, "person 1 RRSP withdrawal");
  near(yearOneYou.federalTax, 1_887.59, "person 1 federal tax");
  near(yearOneYou.provincialTax, 1_450.49, "person 1 Ontario tax, including the health premium");
  near(yearOneYou.oasClawback, 0, "person 1 OAS clawback is zero");
  near(yearOneYou.taxableIncome, 39_142.78, "person 1 taxable income matches person 2");
  near(yearOneSpouse.withdrawals.rrspRrif, 33_142.78, "person 2 RRSP withdrawal");
  near(yearOneSpouse.federalTax, 3_176.71, "person 2 federal tax");
  near(yearOneSpouse.provincialTax, 1_770.77, "person 2 Ontario tax, including the health premium");
  near(yearOneSpouse.oasClawback, 0, "person 2 has no OAS to claw back");
  near(yearOneSpouse.totalTax, 4_947.47, "person 2 total tax");
  near(yearOneSpouse.taxableIncome, 39_142.78, "person 2 taxable income matches person 1");
}

assert(compared.orders.length === 4, "all four orders are compared");
assert(
  compared.orders.every((order) => order.householdRows.length > 0),
  "each order has household rows",
);

// --- Deemed disposition at the horizon, not at the first death -------------

const terminal = compareWithdrawalOrders(
  normalizeRetirementPlan(
    {
      id: "terminal",
      name: "Fictional terminal",
      currentAge: 65,
      retirementAge: 65,
      retirementYear: YEAR,
      planEndAge: 65,
      inflationRate: 0,
      annualLifestyleSpending: 0,
      assets: [
        asset({
          id: "rrsp",
          symbol: "RRSP",
          unitPrice: 100_000,
          quantity: 1,
          accountKind: "rrsp",
        }),
      ],
      withdrawalAssumptions: {
        selectedOrder: "rrsp-first",
        unrealizedGainShare: 0,
        capitalGainsInclusionRate: 0.5,
        meltdownTargetIncome: null,
        annualTfsaRoom: null,
      },
    },
    { currentYear: YEAR },
  ),
  { currentYear: YEAR, cadPerUsd: 1 },
);
const terminalOrder = terminal.orders[0];
assert(terminalOrder.totals.totalTax === 0, "a year with no income and no withdrawal has no lifetime tax");
// Hand check for a 65-year-old with $100,000 of RRSP left and no other income.
// Federal age amount = 9,208 − (100,000 − 46,432) × 0.15 = 1,172.80.
// Federal tax = 16,696.005 − (16,452 + 1,172.80) × 0.14 = 14,228.53.
// Ontario age amount is fully reduced. Basic Ontario tax after the $12,989
// credit is 6,284.52. Surtax is 20% of the amount over $5,818 = 93.30.
// Health premium is $750. Ontario total = 7,127.83.
// Estate tax = 21,356.36. Estate = 100,000 − 21,356.36 = 78,643.64.
near(terminalOrder.totals.endingAfterTaxEstate, 78_643.64, "ending estate is the RRSP net of tax at the horizon");

// --- Indexed thresholds ----------------------------------------------------
// $18,000 is under $20,000 and has no pension income. Brackets, personal
// amounts, and the Ontario low-income reduction scale by 1.03^10. The health
// premium bands stay at the 2026 dollars, so once the inflated income crosses
// $20,000 the premium is subtracted before the comparison.
const indexFactor = 1.03 ** 10;
const indexedIncome = 18_000;
const indexedBase = estimatePersonTax({
  age: 40,
  netIncomeBeforeClawback: indexedIncome,
  oas: 0,
  eligiblePension: 0,
});
const indexedLater = estimatePersonTax(
  {
    age: 40,
    netIncomeBeforeClawback: indexedIncome * indexFactor,
    oas: 0,
    eligiblePension: 0,
  },
  taxTableForYear(YEAR + 10, 3),
);
near(
  indexedLater.totalTax - ontarioHealthPremium(indexedIncome * indexFactor),
  indexedBase.totalTax * indexFactor,
  "3% inflation, year+10, income under $20k with no pension income gives base-year tax × 1.03^10",
);
const indexedTable = taxTableForYear(YEAR + 10, 3);
near(indexedTable.federalBrackets[0].upTo, 58_523 * indexFactor, "the lowest federal bracket indexes", 0.01);
assert(indexedTable.federalPensionAmount === 2_000, "the federal pension amount stays $2,000");
near(indexedTable.tfsaDollarLimit, 7_000 * indexFactor, "the TFSA dollar limit indexes", 0.01);
near(indexedTable.ontarioLowIncomeReduction, 300 * indexFactor, "the Ontario low-income reduction indexes", 0.01);
assert(ontarioHealthPremium(25_000) === 300, "the health premium band stays the 2026 figure");

const indexedMeltdown = createWithdrawalOrderEngine("meltdown", {
  ...engineAssumptions({ meltdownTargetIncome: null, annualTfsaRoom: 0 }),
  inflationRatePercent: 3,
  cadPerUsd: 1,
});
const indexedDraw = indexedMeltdown({
  spendingGap: 0,
  year: YEAR + 10,
  people: [
    {
      id: "person1",
      age: 65,
      retired: true,
      deceased: false,
      cpp: 0,
      oas: 0,
      pension: 0,
      pensionAfterSplit: 0,
      other: 0,
    },
  ],
  accounts: [
    {
      id: "rrsp",
      owner: "person1",
      kind: "rrsp",
      value: 500_000,
      contribution: 0,
      rrifMinimum: 0,
    },
  ],
});
near(
  indexedDraw.withdrawalByAccount.rrsp,
  58_523 * indexFactor,
  "a blank meltdown target uses the indexed bracket for that year",
);

// --- Estate on the second death --------------------------------------------
// Two $400,000 RRSPs, both alive, no other income, no spending. The old
// per-person method taxes each $400,000 on its own return. The horizon now
// puts both balances on the younger person's final return (same age: person 1).

const perPersonEstateTax =
  estimatePersonTax({
    age: 65,
    netIncomeBeforeClawback: 400_000,
    oas: 0,
    eligiblePension: 0,
  }).totalTax * 2;
const combinedEstateTax = estimatePersonTax({
  age: 65,
  netIncomeBeforeClawback: 800_000,
  oas: 0,
  eligiblePension: 0,
}).totalTax;
const stackedEstate = compareWithdrawalOrders(
  normalizeRetirementPlan(
    {
      id: "stacked-estate",
      name: "Fictional stacked estate",
      currentAge: 65,
      retirementAge: 65,
      retirementYear: YEAR,
      planEndAge: 65,
      inflationRate: 0,
      annualLifestyleSpending: 0,
      spouse: { name: "Riley", currentAge: 65, retirementAge: 65 },
      assets: [
        asset({
          id: "rrsp-1",
          symbol: "RRSP1",
          unitPrice: 400_000,
          quantity: 1,
          accountKind: "rrsp",
          owner: "person1",
        }),
        asset({
          id: "rrsp-2",
          symbol: "RRSP2",
          unitPrice: 400_000,
          quantity: 1,
          accountKind: "rrsp",
          owner: "person2",
        }),
      ],
      withdrawalAssumptions: {
        selectedOrder: "rrsp-first",
        unrealizedGainShare: 0,
        capitalGainsInclusionRate: 0.5,
        meltdownTargetIncome: null,
        annualTfsaRoom: null,
      },
    },
    { currentYear: YEAR },
  ),
  { currentYear: YEAR, cadPerUsd: 1 },
);
const stackedOrder = stackedEstate.orders[0];
const stackedEstateTax = 800_000 - stackedOrder.totals.endingAfterTaxEstate;
near(stackedEstateTax, combinedEstateTax, "both RRSPs are taxed on one final return");
near(
  stackedEstateTax - perPersonEstateTax,
  44_666.02,
  "stacking the two RRSPs costs about $44,700 more estate tax than taxing each person",
);

// --- Gross-up convergence at the clawback marginal -------------------------

const clawbackPlan = compareWithdrawalOrders(
  normalizeRetirementPlan(
    {
      id: "clawback-converge",
      name: "Fictional clawback",
      currentAge: 70,
      retirementAge: 70,
      retirementYear: YEAR,
      planEndAge: 70,
      inflationRate: 0,
      annualLifestyleSpending: 280_000,
      assets: [
        asset({
          id: "rrsp",
          symbol: "RRSP",
          unitPrice: 2_000_000,
          quantity: 1,
          accountKind: "rrsp",
        }),
      ],
      incomeStreams: [
        {
          id: "cpp",
          name: "CPP",
          kind: "cpp",
          annualAmount: 141_500,
          startAge: 65,
          colaWithInflation: false,
          owner: "person1",
          survivorPercent: 0,
        },
        {
          id: "oas",
          name: "OAS",
          kind: "oas",
          annualAmount: 8_500,
          startAge: 65,
          colaWithInflation: false,
          owner: "person1",
          survivorPercent: 0,
        },
      ],
      withdrawalAssumptions: {
        selectedOrder: "rrsp-first",
        unrealizedGainShare: 0,
        capitalGainsInclusionRate: 0.5,
        meltdownTargetIncome: 58_523,
        annualTfsaRoom: 7_000,
      },
    },
    { currentYear: YEAR },
  ),
  { currentYear: YEAR, cadPerUsd: 1 },
);
const clawbackRow = clawbackPlan.orders[0].householdRows[0];
assert(clawbackRow != null, "the clawback case has a year");
if (clawbackRow) {
  const withdrawal =
    clawbackRow.withdrawals.rrspRrif +
    clawbackRow.withdrawals.tfsa +
    clawbackRow.withdrawals.nonRegisteredCash;
  const gapBeforeTax = 280_000 - 141_500 - 8_500;
  near(
    withdrawal - gapBeforeTax - clawbackRow.totalTax,
    0,
    "a ~$150k income with clawback converges: withdrawal − gap − tax within $0.01",
    0.01,
  );
  assert(clawbackRow.converged, "the clawback year records that the fixed point converged");
  assert(clawbackRow.oasClawback > 0, "the clawback case is actually in the recovery zone");
}

const survivorPlan = normalizeRetirementPlan(
  {
    id: "survivor-order",
    name: "Fictional survivor",
    currentAge: 70,
    retirementAge: 70,
    retirementYear: YEAR,
    planEndAge: 72,
    inflationRate: 0,
    annualLifestyleSpending: 10_000,
    spouse: { name: "Riley", currentAge: 68, retirementAge: 68 },
    assets: [
      asset({
        id: "rrsp",
        symbol: "RRSP",
        unitPrice: 400_000,
        quantity: 1,
        accountKind: "rrsp",
        owner: "person1",
      }),
    ],
    withdrawalAssumptions: {
      selectedOrder: "rrsp-first",
      unrealizedGainShare: 0,
      capitalGainsInclusionRate: 0.5,
      meltdownTargetIncome: null,
      annualTfsaRoom: null,
    },
  },
  { currentYear: YEAR },
);
const survived = compareWithdrawalOrders(survivorPlan, {
  currentYear: YEAR,
  cadPerUsd: 1,
  survivor: { deceased: "person1", deathAge: 71 },
});
const deathYear = survived.orders[0].householdRows.find((row) => row.year === YEAR + 1);
const deathYou = survived.orders[0].rowsByPerson.person1.find((row) => row.year === YEAR + 1);
const deathSpouse = survived.orders[0].rowsByPerson.person2.find((row) => row.year === YEAR + 1);
assert(deathYou != null && deathYou.alive === false, "person 1 is not alive in the year of death");
assert(deathSpouse != null && deathSpouse.alive, "person 2 is the survivor");
assert(
  deathYear != null && deathYear.taxableIncome < 80_000,
  "the rolled RRSP is not taxed as income in the year of the first death",
);
assert(
  deathYear != null && deathYear.closingBalance > 300_000,
  "the registered balance is still in the plan after the rollover",
);
assert(
  deathYou != null && deathYou.withdrawals.rrspRrif === 0,
  "the deceased does not withdraw the rolled RRSP",
);
assert(
  deathSpouse != null && deathSpouse.withdrawals.rrspRrif > 0,
  "the survivor withdraws from the rolled RRSP to fund spending",
);

// --- Empty plan ------------------------------------------------------------

const empty = compareWithdrawalOrders(
  {
    id: "empty",
    name: "Empty",
    currentAge: 65,
    retirementAge: 65,
    assets: [],
    annualLifestyleSpending: 70_000,
    incomeStreams: [
      {
        id: "cpp",
        name: "CPP",
        kind: "cpp",
        annualAmount: 12_000,
        startAge: 65,
        colaWithInflation: false,
        owner: "person1",
        survivorPercent: 0,
      },
    ],
  },
  { currentYear: YEAR, cadPerUsd: 1 },
);
assert(empty.orders.length === 4, "an empty plan still lists the four orders");
assert(
  empty.orders.every(
    (order) =>
      order.householdRows.length === 0 &&
      order.rowsByPerson.person1.length === 0 &&
      order.totals.totalTax === 0 &&
      order.totals.federalTax === 0 &&
      order.totals.provincialTax === 0 &&
      order.totals.oasClawback === 0 &&
      order.totals.endingAfterTaxEstate === 0 &&
      order.totals.depletionYear == null,
  ),
  "an empty plan returns empty rows and zeros, including when CPP was entered",
);

const legacy = normalizeRetirementPlan(
  { id: "legacy", name: "Legacy", assets: [] },
  { currentYear: YEAR },
);
assert(legacy.withdrawalAssumptions.selectedOrder === "rrsp-first", "an old plan defaults the selected order");
assert(legacy.withdrawalAssumptions.unrealizedGainShare === 0.5, "an old plan defaults the gain share");
assert(legacy.withdrawalAssumptions.meltdownTargetIncome == null, "an old plan leaves the meltdown target on the published bracket");
assert(legacy.withdrawalAssumptions.annualTfsaRoom == null, "an old plan leaves TFSA room on the published limit");

// --- Account identity and funded spending ----------------------------------
// Opening after growth + contribution + surplus moved in − withdrawal = closing.
// Each year either pays the after-tax spending gap or is the depletion year.

function assertOrderInvariants(
  label: string,
  orders: WithdrawalOrderComparison[],
) {
  assert(orders.length === 4, `${label} compares four orders`);
  for (const order of orders) {
    let firstShort: number | null = null;
    let breaks = 0;
    for (const row of order.householdRows) {
      let reinvested = 0;
      for (const account of row.accounts) {
        reinvested += account.reinvested;
        const expected =
          account.afterGrowth +
          account.contribution -
          account.withdrawal +
          account.reinvested;
        if (Math.abs(account.closing - expected) > 0.01) {
          breaks += 1;
          failed += 1;
          console.error(
            `FAIL ${label} ${order.id} ${row.year} ${account.id} closes (got ${account.closing}, expected ${expected})`,
          );
        }
      }
      if (Math.abs(reinvested - row.surplusReinvested) > 0.01) {
        breaks += 1;
        failed += 1;
        console.error(
          `FAIL ${label} ${order.id} ${row.year} surplus matches the account credits (got ${reinvested}, expected ${row.surplusReinvested})`,
        );
      }
      const short = row.fundingShortfall > FUNDING_SHORTFALL_TOLERANCE;
      if (short && firstShort == null) firstShort = row.year;
      if (!short && firstShort != null) {
        breaks += 1;
        failed += 1;
        console.error(
          `FAIL ${label} ${order.id} ${row.year} is funded after depletion began`,
        );
      }
    }
    if (order.totals.depletionYear !== firstShort) {
      breaks += 1;
      failed += 1;
      console.error(
        `FAIL ${label} ${order.id} depletion year is the first unfunded year (got ${order.totals.depletionYear}, expected ${firstShort})`,
      );
    }
    assert(
      breaks === 0,
      `${label} ${order.id} identity and funding hold for ${order.householdRows.length} years`,
    );
  }
}

assertOrderInvariants("golden couple", compared.orders);
const homepageExample = compareWithdrawalOrders(EXAMPLE_COUPLE_PLAN, {
  currentYear: EXAMPLE_COUPLE_YEAR,
  cadPerUsd: EXAMPLE_CAD_PER_USD,
});
assertOrderInvariants("homepage example", homepageExample.orders);
assert(
  homepageExample.orders.find((order) => order.id === "rrsp-first")?.totals.depletionYear ==
    null,
  "the homepage example funds RRSP first through the plan horizon",
);
assert(
  sharedTaxComparison(homepageExample.orders).throughYear == null,
  "the homepage example compares lifetime tax because every order funds the horizon",
);

const samRileyHighSpend = {
  ...EXAMPLE_COUPLE_PLAN,
  id: "sam-riley-180k",
  annualLifestyleSpending: 180_000 / EXAMPLE_CAD_PER_USD,
};
const highSpend = compareWithdrawalOrders(samRileyHighSpend, {
  currentYear: EXAMPLE_COUPLE_YEAR,
  cadPerUsd: EXAMPLE_CAD_PER_USD,
});
assertOrderInvariants("Sam and Riley at $180k", highSpend.orders);

const highRrsp = highSpend.orders.find((order) => order.id === "rrsp-first");
const highMeltdown = highSpend.orders.find((order) => order.id === "meltdown");
assert(
  highRrsp?.totals.depletionYear != null && highMeltdown?.totals.depletionYear != null,
  "at $180k both RRSP first and meltdown run out",
);
if (highRrsp?.totals.depletionYear != null && highMeltdown?.totals.depletionYear != null) {
  assert(
    Math.abs(highRrsp.totals.depletionYear - highMeltdown.totals.depletionYear) <= 3,
    `meltdown depletion stays near RRSP first (RRSP first ${highRrsp.totals.depletionYear}, meltdown ${highMeltdown.totals.depletionYear})`,
  );
}

const highShared = sharedTaxComparison(highSpend.orders);
assert(highShared.throughYear != null, "a depleted comparison uses a shared tax window");
if (highShared.throughYear != null && highRrsp && highMeltdown) {
  const earliest = Math.min(
    ...highSpend.orders
      .map((order) => order.totals.depletionYear)
      .filter((year): year is number => year != null),
  );
  assert(
    highShared.throughYear === earliest - 1,
    "the shared window stops the year before the first depletion",
  );
  const fullWinner = [...highSpend.orders].sort(
    (a, b) => a.totals.totalTax - b.totals.totalTax,
  )[0];
  const sharedWinner = [...highSpend.orders].sort(
    (a, b) =>
      (highShared.taxes[a.id]?.totalTax ?? 0) - (highShared.taxes[b.id]?.totalTax ?? 0),
  )[0];
  assert(
    fullWinner != null && sharedWinner != null && fullWinner.id !== sharedWinner.id,
    "lowest full-horizon tax and lowest shared-window tax are different orders",
  );
  const afterWindow = highMeltdown.householdRows
    .filter((row) => row.year > (highShared.throughYear ?? 0))
    .reduce((sum, row) => sum + row.totalTax, 0);
  near(
    (highShared.taxes.meltdown?.totalTax ?? 0) + afterWindow,
    highMeltdown.totals.totalTax,
    "shared-window tax plus later years equals lifetime tax",
    0.01,
  );
  assert(
    afterWindow > 1_000,
    "meltdown still pays tax after the shared window, so lifetime tax is not the comparison",
  );
  assert(
    highMeltdown.totals.endingAfterTaxEstate < 1,
    "meltdown does not finish the $180k plan with a leftover balance",
  );
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

console.log("\nAll withdrawal-order tests passed");
