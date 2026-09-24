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
assert(
  age72?.rrifMinimum === 5_280,
  `the year they turn 72 uses the age-71 factor 5.28% (got ${age72?.rrifMinimum})`,
);
assert(
  age72?.closingBalance === 94_720,
  `minimum leaves the plan when nothing can receive it (got ${age72?.closingBalance})`,
);
assert(age72?.rrifSurplusLeftPlan === 5_280, "surplus above a zero spending gap leaves the plan");
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
assert(due?.rrifMinimum === 5_280, "a plan that starts at 72 uses the age-71 factor");
assert(due?.assetBreakdown.rrsp === 94_720, "the minimum comes out of the RRIF");
assert(due?.assetBreakdown.open === 15_280, "surplus is reinvested in the non-registered account");
assert(due?.rrifSurplusReinvested === 5_280, "reinvested surplus is reported");
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
  tfsaYear?.assetBreakdown.tfsa === 6_280,
  "when no taxable account exists, RRIF surplus is reinvested in the TFSA",
);
assert(tfsaYear?.rrifSurplusLeftPlan === 0, "TFSA surplus does not leave the plan");

const turn81 = base({
  currentAge: 81,
  retirementAge: 81,
  retirementYear: YEAR,
  planEndAge: 81,
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
const age81 = row(turn81, YEAR);
assert(age81?.age === 81, "this row is the year they turn 81");
assert(
  age81?.rrifMinimum === 6_820,
  `the year they turn 81 uses the start-of-year factor 6.82% (got ${age81?.rrifMinimum})`,
);
assert(age81?.closingBalance === 93_180, "the age-81 minimum leaves the only account");

const turn96 = base({
  currentAge: 96,
  retirementAge: 96,
  retirementYear: YEAR,
  planEndAge: 96,
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
const age96 = row(turn96, YEAR);
assert(age96?.age === 96, "this row is the year they turn 96");
assert(age96?.rrifMinimum === 20_000, `the year they turn 96 uses 20% (got ${age96?.rrifMinimum})`);
assert(age96?.closingBalance === 80_000, "the age-96 minimum is a fifth of the opening value");

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
      unitPrice: 290_000,
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
  `minimum uses the survivor's age at the start of the year, 61, factor 1/29 (got ${death?.rrifMinimum})`,
);
assert(death?.incomeByPerson.person1.cpp === 0, "CPP stops at death even if a survivor percent is set");
assert(death?.income === 2_500, "half the pension continues and nothing is invented");
assert(death?.closingBalance === 280_000, "the minimum leaves the RRIF and the rest stays in the household");
const yearAfter = afterDeath.find((item) => item.year === YEAR + 3);
assert(
  yearAfter?.rrifMinimum === 10_000,
  `the next year still uses the survivor's start-of-year age (got ${yearAfter?.rrifMinimum})`,
);
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

function householdFingerprint(rows: ReturnType<typeof computeRetirementProjections>): string {
  return JSON.stringify(
    rows.map((item) => ({
      year: item.year,
      closingBalance: item.closingBalance,
      income: item.income,
      rrifMinimum: item.rrifMinimum,
      deceased: item.deceased,
    })),
  );
}

const deathAtCurrentAge = computeRetirementProjections(survivorPlan, {
  currentYear: YEAR,
  survivor: { deceased: "person1", deathAge: 70 },
});
const deathBeforeCurrentAge = computeRetirementProjections(survivorPlan, {
  currentYear: YEAR,
  survivor: { deceased: "person2", deathAge: 60 },
});
assert(
  householdFingerprint(deathAtCurrentAge) === householdFingerprint(alive),
  "a death age equal to the current age is ignored",
);
assert(
  householdFingerprint(deathBeforeCurrentAge) === householdFingerprint(alive),
  "a death age below the current age is ignored",
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

// --- Single-person path matches main's engine before this change ----------
// Captured from origin/main fc19934 via normalizeRetirementPlan +
// computeRetirementProjections. The stored document has no account fields.

const LEGACY_GOLDEN: Array<{
  year: number;
  age: number;
  openingBalance: number;
  assetAppreciation: number;
  balanceAfterAppreciation: number;
  contribution: number;
  lifestyleSpending: number;
  income: number;
  portfolioWithdrawal: number;
  closingBalance: number;
  assetBreakdown: Record<string, number>;
}> = [
  {
    year: 2026,
    age: 55,
    openingBalance: 23000,
    assetAppreciation: 995.0000000000001,
    balanceAfterAppreciation: 23995,
    contribution: 12000,
    lifestyleSpending: 0,
    income: 0,
    portfolioWithdrawal: 0,
    closingBalance: 35995,
    assetBreakdown: {
      voo: 16051.114815586581,
      bond: 7763.039174828089,
      cash: 12180.84600958533,
    },
  },
  {
    year: 2027,
    age: 56,
    openingBalance: 35995,
    assetAppreciation: 1577.9970983538242,
    balanceAfterAppreciation: 37572.99709835382,
    contribution: 12000,
    lifestyleSpending: 0,
    income: 0,
    portfolioWithdrawal: 0,
    closingBalance: 49572.99709835382,
    assetBreakdown: {
      voo: 22659.917086790214,
      bond: 10600.868932350793,
      cash: 16312.211079212819,
    },
  },
  {
    year: 2028,
    age: 57,
    openingBalance: 49572.99709835382,
    assetAppreciation: 2201.907774895785,
    balanceAfterAppreciation: 51774.90487324961,
    contribution: 12000,
    lifestyleSpending: 0,
    income: 0,
    portfolioWithdrawal: 0,
    closingBalance: 63774.9048732496,
    assetBreakdown: {
      voo: 29865.693513034188,
      bond: 13514.884068221503,
      cash: 20394.327291993915,
    },
  },
  {
    year: 2029,
    age: 58,
    openingBalance: 63774.9048732496,
    assetAppreciation: 2869.534397680055,
    balanceAfterAppreciation: 66644.43927092967,
    contribution: 12000,
    lifestyleSpending: 0,
    income: 0,
    portfolioWithdrawal: 0,
    closingBalance: 78644.43927092967,
    assetBreakdown: {
      voo: 37710.343093098374,
      bond: 16506.56766219119,
      cash: 24427.528515640097,
    },
  },
  {
    year: 2030,
    age: 59,
    openingBalance: 78644.43927092967,
    assetAppreciation: 3583.86681242818,
    balanceAfterAppreciation: 82228.30608335783,
    contribution: 12000,
    lifestyleSpending: 0,
    income: 0,
    portfolioWithdrawal: 0,
    closingBalance: 94228.30608335783,
    assetBreakdown: {
      voo: 46238.56011620269,
      bond: 19577.497015185032,
      cash: 28412.24895197012,
    },
  },
  {
    year: 2031,
    age: 60,
    openingBalance: 94228.30608335783,
    assetAppreciation: 4348.095337945216,
    balanceAfterAppreciation: 98576.40142130305,
    contribution: 12000,
    lifestyleSpending: 0,
    income: 0,
    portfolioWithdrawal: 0,
    closingBalance: 110576.40142130306,
    assetBreakdown: {
      voo: 55498.0305285182,
      bond: 22729.34959460185,
      cash: 32349.021298183012,
    },
  },
  {
    year: 2032,
    age: 61,
    openingBalance: 110576.40142130306,
    assetAppreciation: 5165.624692280084,
    balanceAfterAppreciation: 115742.02611358314,
    contribution: 12000,
    lifestyleSpending: 0,
    income: 0,
    portfolioWithdrawal: 0,
    closingBalance: 127742.02611358315,
    assetBreakdown: {
      voo: 65539.64260254141,
      bond: 25963.908973222664,
      cash: 36238.474537819064,
    },
  },
  {
    year: 2033,
    age: 62,
    openingBalance: 127742.02611358315,
    assetAppreciation: 6040.0889143079785,
    balanceAfterAppreciation: 133782.11502789112,
    contribution: 12000,
    lifestyleSpending: 0,
    income: 0,
    portfolioWithdrawal: 0,
    closingBalance: 145782.11502789112,
    assetBreakdown: {
      voo: 76417.71289692295,
      bond: 29283.070748650407,
      cash: 40081.33138231777,
    },
  },
  {
    year: 2034,
    age: 63,
    openingBalance: 145782.11502789112,
    assetAppreciation: 6975.367349722137,
    balanceAfterAppreciation: 152757.48237761325,
    contribution: 12000,
    lifestyleSpending: 0,
    income: 0,
    portfolioWithdrawal: 0,
    closingBalance: 164757.48237761325,
    assetBreakdown: {
      voo: 88190.22855893339,
      bond: 32688.84843191242,
      cash: 43878.40538676745,
    },
  },
  {
    year: 2035,
    age: 64,
    openingBalance: 164757.48237761325,
    assetAppreciation: 7975.601775043784,
    balanceAfterAppreciation: 172733.08415265704,
    contribution: 12000,
    lifestyleSpending: 0,
    income: 0,
    portfolioWithdrawal: 0,
    closingBalance: 184733.08415265704,
    assetBreakdown: {
      voo: 100919.10709115141,
      bond: 36183.37929571262,
      cash: 47630.59776579301,
    },
  },
  {
    year: 2036,
    age: 65,
    openingBalance: 184733.08415265704,
    assetAppreciation: 9045.214738217435,
    balanceAfterAppreciation: 193778.2988908745,
    contribution: 0,
    lifestyleSpending: 48000,
    income: 25520.76089776721,
    portfolioWithdrawal: 22479.23910223279,
    closingBalance: 171299.0597886417,
    assetBreakdown: {
      voo: 95456.8320418578,
      bond: 33105.43621198069,
      cash: 42736.79153480321,
    },
  },
  {
    year: 2037,
    age: 66,
    openingBalance: 171299.0597886417,
    assetAppreciation: 8481.720383371417,
    balanceAfterAppreciation: 179780.7801720131,
    contribution: 0,
    lifestyleSpending: 49199.99999999999,
    income: 25808.77992021139,
    portfolioWithdrawal: 23391.220079788603,
    closingBalance: 156389.5600922245,
    assetBreakdown: {
      voo: 88849.56219178633,
      bond: 29806.031890231436,
      cash: 37733.96601020675,
    },
  },
  {
    year: 2038,
    age: 67,
    openingBalance: 156389.5600922245,
    assetAppreciation: 7828.689959736245,
    balanceAfterAppreciation: 164218.25005196076,
    contribution: 0,
    lifestyleSpending: 50429.99999999999,
    income: 26103.999418216674,
    portfolioWithdrawal: 24326.00058178332,
    closingBalance: 139892.24947017743,
    assetBreakdown: {
      voo: 80986.25258521979,
      bond: 26279.478664828483,
      cash: 32626.518220129165,
    },
  },
  {
    year: 2039,
    age: 68,
    openingBalance: 139892.24947017743,
    assetAppreciation: 7078.21720753632,
    balanceAfterAppreciation: 146970.46667771373,
    contribution: 0,
    lifestyleSpending: 51690.749999999985,
    income: 26406.599403672088,
    portfolioWithdrawal: 25284.150596327898,
    closingBalance: 121686.31608138584,
    assetBreakdown: {
      voo: 71747.49648566115,
      bond: 22520.01966949203,
      cash: 27418.799926232663,
    },
  },
];

const legacyRaw = {
  id: "legacy-golden",
  name: "Legacy single",
  retirementYear: YEAR + 20,
  currentAge: 55,
  retirementAge: 65,
  planEndAge: 68,
  annualLifestyleSpending: 48_000,
  inflationRate: 2.5,
  annualContribution: 12_000,
  withdrawalRate: 4,
  currency: "CAD",
  spouse: null,
  priceProjectionScenario: "expected",
  assets: [
    {
      id: "voo",
      symbol: "VOO",
      name: "Broad equity",
      type: "stock",
      unitPrice: 400,
      quantity: 25,
      expectedCagr: 7,
    },
    {
      id: "bond",
      symbol: "BOND",
      name: "Bonds",
      type: "custom",
      unitPrice: 50,
      quantity: 100,
      expectedCagr: 3.5,
    },
    {
      id: "cash",
      symbol: "CASH",
      name: "Cash",
      type: "cash",
      unitPrice: 1,
      quantity: 8_000,
      expectedCagr: 1.5,
    },
  ],
  incomeStreams: [
    {
      id: "cpp",
      name: "CPP",
      kind: "cpp",
      annualAmount: 9_000,
      startAge: 65,
      colaWithInflation: true,
    },
    {
      id: "pension",
      name: "Pension",
      kind: "pension",
      annualAmount: 14_000,
      startAge: 65,
      colaWithInflation: false,
    },
  ],
  createdAt: "2024-03-01T00:00:00.000Z",
  updatedAt: "2024-06-01T00:00:00.000Z",
};

const legacyPlan = normalizeRetirementPlan(legacyRaw, { currentYear: YEAR });
const legacyRows = computeRetirementProjections(legacyPlan, { currentYear: YEAR });
assert(
  legacyRows.length === LEGACY_GOLDEN.length,
  `legacy single-person row count matches main (${legacyRows.length} vs ${LEGACY_GOLDEN.length})`,
);
for (let index = 0; index < LEGACY_GOLDEN.length; index += 1) {
  const expected = LEGACY_GOLDEN[index];
  const actual = legacyRows[index];
  if (!actual || !expected) {
    assert(false, `legacy row ${index} exists`);
    continue;
  }
  const comparable = {
    year: actual.year,
    age: actual.age,
    openingBalance: actual.openingBalance,
    assetAppreciation: actual.assetAppreciation,
    balanceAfterAppreciation: actual.balanceAfterAppreciation,
    contribution: actual.contribution,
    lifestyleSpending: actual.lifestyleSpending,
    income: actual.income,
    portfolioWithdrawal: actual.portfolioWithdrawal,
    closingBalance: actual.closingBalance,
    assetBreakdown: actual.assetBreakdown,
  };
  assert(
    JSON.stringify(comparable) === JSON.stringify(expected),
    `legacy ${expected.year} matches main's engine before this change`,
  );
}

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall retire account tests passed");
