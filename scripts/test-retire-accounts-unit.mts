/**
 * RRIF conversion and minimums, couples projections, and the survivor view.
 *   npx tsx --tsconfig tsconfig.json scripts/test-retire-accounts-unit.mts
 */
import { prescribedRrifFactor } from "../src/lib/retirement/rrif.ts";
import { runRetirementMonteCarlo } from "../src/lib/retirement/monte-carlo.ts";
import { normalizeRetirementPlan } from "../src/lib/retirement/normalize.ts";
import {
  computeRetirementProjections,
  findDepletionAge,
} from "../src/lib/retirement/projections.ts";
import {
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

const YEAR = 2026;

function asset(
  partial: Pick<RetirementPlanAsset, "id" | "symbol" | "unitPrice" | "quantity"> &
    Partial<RetirementPlanAsset>,
): RetirementPlanAsset {
  const type = partial.type ?? "custom";
  return {
    name: partial.name ?? partial.symbol,
    type,
    expectedCagr: partial.expectedCagr ?? 0,
    accountKind: partial.accountKind ?? (type === "cash" ? "cash" : "non_registered"),
    owner: partial.owner ?? "person1",
    annualContribution: partial.annualContribution ?? 0,
    ...partial,
  };
}

function base(overrides: Partial<RetirementPlan> = {}): RetirementPlan {
  const plan = createEmptyPlan("Accounts");
  return {
    ...plan,
    id: "plan-accounts",
    currentAge: 70,
    retirementAge: 70,
    retirementYear: YEAR,
    planEndAge: 75,
    inflationRate: 0,
    annualLifestyleSpending: 0,
    annualContribution: 0,
    pensionSplitPercent: 0,
    incomeStreams: [],
    assets: [],
    ...overrides,
  };
}

function row(plan: RetirementPlan, year: number) {
  return computeRetirementProjections(plan, { currentYear: YEAR }).find(
    (item) => item.year === year,
  );
}

// --- Prescribed factors ----------------------------------------------------

assert(prescribedRrifFactor(70) === 1 / 20, "age 70 factor is 1/20");
assert(prescribedRrifFactor(71) === 0.0528, "age 71 factor is 5.28%");
assert(prescribedRrifFactor(72) === 0.054, "age 72 factor is 5.40%");
assert(prescribedRrifFactor(73) === 0.0553, "age 73 factor is 5.53%");
assert(prescribedRrifFactor(94) === 0.1879, "age 94 factor is 18.79%");
assert(prescribedRrifFactor(95) === 0.2, "age 95 factor is 20%");
assert(prescribedRrifFactor(100) === 0.2, "age 100 factor stays 20%");
assert(prescribedRrifFactor(71.9) === 0.0528, "fractional age uses the age attained");

// --- Conversion at the end of the year the owner turns 71 ------------------

const rrspOnly = base({
  currentAge: 70,
  retirementAge: 70,
  retirementYear: YEAR,
  planEndAge: 73,
  assets: [
    asset({
      id: "rrsp",
      symbol: "RRSP",
      unitPrice: 100_000,
      quantity: 1,
      accountKind: "rrsp",
    }),
  ],
});

const age70 = row(rrspOnly, YEAR);
const age71 = row(rrspOnly, YEAR + 1);
const age72 = row(rrspOnly, YEAR + 2);
assert(age70?.accountKindById.rrsp === "rrsp", "age 70 is still an RRSP");
assert(age70?.rrifMinimum === 0, "no minimum before conversion");
assert(age70?.closingBalance === 100_000, "RRSP balance is unchanged at 70");
assert(age71?.age === 71, "the next year is the year they turn 71");
assert(age71?.accountKindById.rrsp === "rrsp", "conversion waits until year-end at 71");
assert(age71?.rrifMinimum === 0, "no minimum in the conversion year");
assert(age71?.closingBalance === 100_000, "conversion year does not withdraw");
assert(age72?.accountKindById.rrsp === "rrif", "the following year is a RRIF");
assert(age72?.rrifMinimum === 5_400, `age 72 minimum is 5.40% (got ${age72?.rrifMinimum})`);
assert(
  age72?.closingBalance === 94_600,
  `minimum leaves the plan when nothing can receive it (got ${age72?.closingBalance})`,
);
assert(age72?.rrifSurplusLeftPlan === 5_400, "surplus above a zero spending gap leaves the plan");
assert(age72?.portfolioWithdrawal === 0, "the lifestyle withdrawal stays zero");

const alreadyDue = base({
  currentAge: 72,
  retirementAge: 72,
  retirementYear: YEAR,
  planEndAge: 73,
  assets: [
    asset({
      id: "rrsp",
      symbol: "RRSP",
      unitPrice: 100_000,
      quantity: 1,
      accountKind: "rrsp",
    }),
    asset({
      id: "open",
      symbol: "TAX",
      unitPrice: 10_000,
      quantity: 1,
      accountKind: "non_registered",
    }),
  ],
});
const due = row(alreadyDue, YEAR);
assert(due?.accountKindById.rrsp === "rrif", "an RRSP is already a RRIF when the plan starts after 71");
assert(due?.rrifMinimum === 5_400, "first year uses the age-72 minimum");
assert(due?.assetBreakdown.rrsp === 94_600, "the minimum comes out of the RRIF");
assert(due?.assetBreakdown.open === 15_400, "surplus is reinvested in the non-registered account");
assert(due?.rrifSurplusReinvested === 5_400, "reinvested surplus is reported");
assert(due?.rrifSurplusLeftPlan === 0, "surplus does not leave when a taxable account exists");
assert(due?.closingBalance === 110_000, "reinvestment keeps the household total");

const tfsaOnly = base({
  currentAge: 72,
  retirementAge: 72,
  retirementYear: YEAR,
  planEndAge: 72,
  assets: [
    asset({
      id: "rrsp",
      symbol: "RRSP",
      unitPrice: 100_000,
      quantity: 1,
      accountKind: "rrsp",
    }),
    asset({
      id: "tfsa",
      symbol: "TFSA",
      unitPrice: 1_000,
      quantity: 1,
      accountKind: "tfsa",
    }),
  ],
});
const tfsaYear = row(tfsaOnly, YEAR);
assert(
  tfsaYear?.assetBreakdown.tfsa === 6_400,
  "when no taxable account exists, RRIF surplus is reinvested in the TFSA",
);
assert(tfsaYear?.rrifSurplusLeftPlan === 0, "TFSA surplus does not leave the plan");

// --- Existing plans migrate without dropping balances ----------------------

const legacy = normalizeRetirementPlan(
  {
    id: "old",
    name: "Old",
    retirementYear: YEAR + 10,
    annualLifestyleSpending: 40_000,
    inflationRate: 2,
    assets: [
      {
        id: "voo",
        symbol: "VOO",
        name: "S&P 500",
        type: "stock",
        unitPrice: 500,
        quantity: 10,
        expectedCagr: 7,
      },
      {
        id: "cash",
        symbol: "CASH",
        name: "Cash",
        type: "cash",
        unitPrice: 1,
        quantity: 2_000,
        expectedCagr: 2,
      },
    ],
    incomeStreams: [
      {
        id: "cpp",
        name: "CPP",
        kind: "cpp",
        annualAmount: 8_000,
        startAge: 65,
        colaWithInflation: true,
      },
    ],
  },
  { currentYear: YEAR },
);
assert(legacy.assets[0].accountKind === "non_registered", "a stock with no account type becomes non-registered");
assert(legacy.assets[0].owner === "person1", "migrated owner is person 1");
assert(legacy.assets[0].annualContribution === 0, "migrated contribution is zero");
assert(legacy.assets[0].quantity === 10, "migration keeps quantity");
assert(legacy.assets[0].unitPrice === 500, "migration keeps price");
assert(legacy.assets[0].expectedCagr === 7, "migration keeps CAGR");
assert(legacy.assets[1].accountKind === "cash", "a cash holding stays a cash account");
assert(legacy.assets[1].quantity === 2_000, "cash balance is kept");
assert(legacy.incomeStreams[0].owner === "person1", "income without an owner stays with person 1");
assert(legacy.incomeStreams[0].annualAmount === 8_000, "income amount is kept");
assert(legacy.incomeStreams[0].survivorPercent === 0, "survivor percent defaults to zero");
assert(legacy.pensionSplitPercent === 0, "pension split defaults to zero");

const kept = normalizeRetirementPlan(
  {
    ...legacy,
    assets: [
      {
        ...legacy.assets[0],
        accountKind: "tfsa",
        owner: "person2",
        annualContribution: 1_500,
      },
    ],
    pensionSplitPercent: 40,
  },
  { currentYear: YEAR },
);
assert(kept.assets[0].accountKind === "tfsa", "an explicit TFSA is kept");
assert(kept.assets[0].owner === "person2", "an explicit owner is kept");
assert(kept.assets[0].annualContribution === 1_500, "an explicit contribution is kept");
assert(kept.assets[0].quantity === 10, "re-normalize keeps the balance");
assert(kept.pensionSplitPercent === 40, "an explicit pension split is kept");

// --- Couples: separate ages, savings, CPP, and pensions --------------------

const couple = base({
  currentAge: 60,
  retirementAge: 62,
  retirementYear: YEAR + 2,
  planEndAge: 70,
  annualLifestyleSpending: 10_000,
  spouse: { name: "Ari", currentAge: 55, retirementAge: 65 },
  pensionSplitPercent: 40,
  assets: [
    asset({
      id: "you",
      symbol: "YOU",
      unitPrice: 200_000,
      quantity: 1,
      accountKind: "non_registered",
      owner: "person1",
      annualContribution: 2_000,
    }),
    asset({
      id: "ari",
      symbol: "ARI",
      unitPrice: 50_000,
      quantity: 1,
      accountKind: "tfsa",
      owner: "person2",
      annualContribution: 3_000,
    }),
  ],
  incomeStreams: [
    {
      id: "cpp-you",
      name: "CPP",
      kind: "cpp",
      annualAmount: 8_000,
      startAge: 65,
      colaWithInflation: false,
      owner: "person1",
      survivorPercent: 100,
    },
    {
      id: "cpp-ari",
      name: "CPP",
      kind: "cpp",
      annualAmount: 9_000,
      startAge: 65,
      colaWithInflation: false,
      owner: "person2",
      survivorPercent: 0,
    },
    {
      id: "pension-you",
      name: "Pension",
      kind: "pension",
      annualAmount: 10_000,
      startAge: 62,
      colaWithInflation: false,
      owner: "person1",
      survivorPercent: 0,
    },
  ],
});

const working = row(couple, YEAR);
const youRetire = row(couple, YEAR + 2);
const yourCpp = row(couple, YEAR + 5);
const ariCpp = row(couple, YEAR + 10);
assert(working?.spouseAge === 55, "spouse age is modeled");
assert(working?.contribution === 5_000, "both people's account savings are added");
assert(working?.assetBreakdown.you === 202_000, "your contribution stays on your account");
assert(working?.assetBreakdown.ari === 53_000, "spouse contribution stays on their account");
assert(working?.lifestyleSpending === 0, "spending waits until the first retirement");
assert(working?.income === 0, "income is not invented before retirement");
assert(youRetire?.age === 62, "your target age is the retirement year");
assert(youRetire?.spouseAge === 57, "spouse is still working that year");
assert(youRetire?.contribution === 3_000, "only the spouse is still saving after you retire");
assert(youRetire?.lifestyleSpending === 10_000, "household spending starts at the first retirement");
assert(youRetire?.income === 10_000, "your pension starts at your target age");
assert(
  youRetire?.incomeByPerson.person1.pensionAfterSplit === 6_000,
  "40% of the pension is assigned to the spouse",
);
assert(
  youRetire?.incomeByPerson.person2.pensionAfterSplit === 4_000,
  "the spouse receives the assigned pension",
);
assert(youRetire?.income === 10_000, "the split does not change the household total");
assert(youRetire?.incomeByPerson.person1.cpp === 0, "CPP waits for its own start age");
assert(youRetire?.portfolioWithdrawal === 0, "pension covers spending in that year");
assert(yourCpp?.age === 65, "your CPP year is age 65");
assert(yourCpp?.incomeByPerson.person1.cpp === 8_000, "your CPP uses your start age");
assert(yourCpp?.incomeByPerson.person2.cpp === 0, "spouse CPP has not started");
assert(ariCpp?.spouseAge === 65, "spouse CPP year is the spouse's age 65");
assert(ariCpp?.incomeByPerson.person2.cpp === 9_000, "spouse CPP uses the spouse start age");
assert(ariCpp?.contribution === 0, "spouse savings stop at the spouse target age");

const coupleRows = computeRetirementProjections(couple, { currentYear: YEAR });
const singleHorizon = base({
  currentAge: 60,
  retirementAge: 62,
  retirementYear: YEAR + 2,
  planEndAge: 70,
}).planEndAge;
assert(
  coupleRows[coupleRows.length - 1].spouseAge === 70,
  "the horizon runs until the younger person reaches plan end age",
);
assert(
  coupleRows.length > singleHorizon - 60,
  "a younger spouse extends the calendar horizon",
);

const mc = runRetirementMonteCarlo(couple, {
  currentYear: YEAR,
  paths: 20,
  seed: 3,
});
assert(mc.paths === 20, "Monte Carlo path count is honored for a couple");
assert(mc.percentiles.length === coupleRows.length, "Monte Carlo covers every couple year");
assert(
  mc.percentiles.every((band) => band.spouseAge != null),
  "Monte Carlo keeps the spouse age on each year",
);
assert(mc.successRate > 0 && mc.successRate <= 1, "couple success rate is a real share of paths");

// --- Survivor view ---------------------------------------------------------

const survivorPlan = base({
  currentAge: 70,
  retirementAge: 65,
  retirementYear: YEAR - 5,
  planEndAge: 74,
  annualLifestyleSpending: 0,
  spouse: { name: "Ari", currentAge: 60, retirementAge: 65 },
  assets: [
    asset({
      id: "rrsp",
      symbol: "RRSP",
      unitPrice: 280_000,
      quantity: 1,
      accountKind: "rrsp",
      owner: "person1",
    }),
  ],
  incomeStreams: [
    {
      id: "cpp",
      name: "CPP",
      kind: "cpp",
      annualAmount: 5_000,
      startAge: 65,
      colaWithInflation: false,
      owner: "person1",
      survivorPercent: 100,
    },
    {
      id: "pension",
      name: "Pension",
      kind: "pension",
      annualAmount: 5_000,
      startAge: 65,
      colaWithInflation: false,
      owner: "person1",
      survivorPercent: 50,
    },
  ],
});

const alive = computeRetirementProjections(survivorPlan, { currentYear: YEAR });
const afterDeath = computeRetirementProjections(survivorPlan, {
  currentYear: YEAR,
  survivor: { deceased: "person1", deathAge: 72 },
});
const death = afterDeath.find((item) => item.year === YEAR + 2);
const yearBefore = afterDeath.find((item) => item.year === YEAR + 1);
assert(yearBefore?.deceased.length === 0, "the year before the chosen age both people are alive");
assert(yearBefore?.accountKindById.rrsp === "rrsp", "the RRSP converts at the end of age 71");
assert(yearBefore?.income === 10_000, "CPP and pension are paid in the last living year");
assert(death?.deceased.includes("person1") === true, "death applies in the year they reach that age");
assert(death?.spouseAge === 62, "the survivor's age is used that year");
assert(death?.accountKindById.rrsp === "rrif", "the transferred account is already a RRIF");
assert(
  death?.rrifMinimum === 10_000,
  `minimum uses the survivor age 62 factor 1/28 (got ${death?.rrifMinimum})`,
);
assert(death?.incomeByPerson.person1.cpp === 0, "CPP stops at death even if a survivor percent is set");
assert(death?.income === 2_500, "half the pension continues and nothing is invented");
assert(death?.closingBalance === 270_000, "the minimum leaves the RRIF and the rest stays in the household");
assert(
  (alive.find((item) => item.year === YEAR + 2)?.rrifMinimum ?? 0) > (death?.rrifMinimum ?? 0),
  "without the death, the older owner's age-72 minimum is larger",
);

const noAge = findDepletionAge(afterDeath);
assert(noAge == null || typeof noAge === "number", "depletion age is defined for the survivor path");

const survivorMc = runRetirementMonteCarlo(survivorPlan, {
  currentYear: YEAR,
  paths: 15,
  seed: 9,
  survivor: { deceased: "person1", deathAge: 72 },
});
assert(survivorMc.paths === 15, "survivor Monte Carlo uses the same engine");
assert(
  survivorMc.percentiles.length === afterDeath.length,
  "survivor Monte Carlo matches the survivor horizon",
);

// --- Tax hook plugs in without changing the default ------------------------

const taxed = computeRetirementProjections(
  base({
    currentAge: 70,
    retirementAge: 70,
    retirementYear: YEAR,
    planEndAge: 70,
    annualLifestyleSpending: 20_000,
    assets: [
      asset({
        id: "cash",
        symbol: "CASH",
        type: "cash",
        unitPrice: 1,
        quantity: 100_000,
        accountKind: "cash",
      }),
    ],
  }),
  {
    currentYear: YEAR,
    taxEngine: () => ({ taxPayable: 1_000 }),
  },
);
assert(taxed[0].taxPayable === 1_000, "a tax engine's payable amount is recorded");
assert(taxed[0].portfolioWithdrawal === 21_000, "tax increases the portfolio withdrawal");
assert(taxed[0].closingBalance === 79_000, "the extra tax is withdrawn from the portfolio");

const untaxed = computeRetirementProjections(
  base({
    currentAge: 70,
    retirementAge: 70,
    retirementYear: YEAR,
    planEndAge: 70,
    annualLifestyleSpending: 20_000,
    assets: [
      asset({
        id: "cash",
        symbol: "CASH",
        type: "cash",
        unitPrice: 1,
        quantity: 100_000,
        accountKind: "cash",
      }),
    ],
  }),
  { currentYear: YEAR },
);
assert(untaxed[0].taxPayable === 0, "the default tax hook is zero");
assert(untaxed[0].portfolioWithdrawal === 20_000, "without a tax engine the withdrawal is spending");

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall retire account tests passed");
