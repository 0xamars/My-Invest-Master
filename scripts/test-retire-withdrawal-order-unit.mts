/**
 * Withdrawal-order comparison and the 2026 federal + Ontario tax estimate.
 *   npx tsx --tsconfig tsconfig.json scripts/test-retire-withdrawal-order-unit.mts
 *
 * The golden couple is fictional. None of these balances are a real household.
 */
import { estimatePersonTax } from "../src/lib/retirement/tax-ca.ts";
import { normalizeRetirementPlan } from "../src/lib/retirement/normalize.ts";
import {
  compareWithdrawalOrders,
  createWithdrawalOrderEngine,
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
// Person 2's taxable income starts at $6,000 and person 1's at $18,500, so
// person 2 is drawn first. A non-registered balance exists only for person 1.

const rrspFirst = taken("rrsp-first", 45_500);
assert(rrspFirst.withdrawalByAccount["rrsp-2"] === 45_500, "RRSP first draws person 2's RRSP");
assert((rrspFirst.withdrawalByAccount["rrsp-1"] ?? 0) === 0, "RRSP first leaves person 1's RRSP");
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
assert(tfsaLastWide.withdrawalByAccount["rrsp-2"] === 70_000, "TFSA last then draws the lower-income RRSP");
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
// Person 2 has the lower taxable income, and their RRSP covers the gap, so the
// whole RRSP withdrawal W is theirs. W = 45,500 + person 2's tax. Person 1's
// tax on $18,500 is zero: federal tax 18,500 × 0.14 = 2,590 is under the
// credit (16,452 + 9,208) × 0.14 = 3,592.40, and Ontario 18,500 × 0.0505 =
// 934.25 is under (12,989 + 6,342) × 0.0505 = 976.22. Health premium is zero
// at $18,500.
//
// Person 2, age 63, no age amount and no OAS. Let N = 6,000 + W = 51,500 + T.
// The fixed point lands in the second federal bracket and the second Ontario
// bracket, with the health premium capped at $600 and no Ontario surtax:
//   federal = 0.205 N − 6,107.275
//   Ontario basic = 0.0915 N − 2,865.4755
//   T = federal + Ontario basic + 600 = 0.2965 N − 8,372.7505
//   N = 51,500 + T = 43,127.2495 + 0.2965 N
//   N = 43,127.2495 / 0.7035 = 61,303.8372
//   T = 9,803.8372
//   federal = 6,460.01, Ontario including the $600 premium = 3,343.83
//   W = 55,303.84
// Clawback is zero because $61,304 is under $95,323.

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
  near(yearOneYou.withdrawals.rrspRrif, 0, "person 1 withdraws no RRSP in year 1");
  near(yearOneYou.federalTax, 0, "person 1 federal tax is zero");
  near(yearOneYou.provincialTax, 0, "person 1 Ontario tax is zero");
  near(yearOneYou.oasClawback, 0, "person 1 OAS clawback is zero");
  near(yearOneYou.taxableIncome, 18_500, "person 1 taxable income is CPP plus OAS");
  near(yearOneSpouse.withdrawals.rrspRrif, 55_303.84, "person 2 RRSP withdrawal");
  near(yearOneSpouse.federalTax, 6_460.01, "person 2 federal tax");
  near(yearOneSpouse.provincialTax, 3_343.83, "person 2 Ontario tax, including the health premium");
  near(yearOneSpouse.oasClawback, 0, "person 2 has no OAS to claw back");
  near(yearOneSpouse.totalTax, 9_803.84, "person 2 total tax");
  near(yearOneSpouse.taxableIncome, 61_303.84, "person 2 taxable income");
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

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

console.log("\nAll withdrawal-order tests passed");
