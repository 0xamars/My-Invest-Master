import type {
  ProjectedAccountKind,
  RetirementPersonId,
} from "@/types/retirement";
import type {
  RetirementTaxEngine,
  RetirementTaxPersonDetail,
  RetirementTaxYearInput,
} from "@/lib/retirement/tax-year";

/**
 * Federal and Ontario figures for the 2026 tax year. Dollar amounts are
 * Canadian dollars. Rates are decimals.
 *
 * Sources, one per figure:
 * - Federal brackets and the 14% lowest rate:
 *   https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html
 * - Federal basic personal amount ($16,452, phase-out from $181,440 to a
 *   $14,829 floor at $258,482), age amount ($9,208 from $46,432, 15% to
 *   $107,819), and pension amount ($2,000):
 *   https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/td1/td1-26e.pdf
 *   https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/td1-ws/td1-ws-26e.pdf
 * - Non-refundable credits use the lowest federal rate, 14% for 2026.
 * - OAS recovery tax, 15% above $95,323 of 2026 net income:
 *   https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/recovery-tax.html
 * - Ontario brackets, basic personal amount ($12,989), surtax ($5,818 / 20%
 *   and $7,446 / 36%), and Ontario health premium:
 *   https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables/t4032on-jan/t4032on-january-general-information.html
 * - Ontario age amount ($6,342, net income $47,210 to $89,490) and pension
 *   amount ($1,796). The 15% reduction is the rate that joins those three
 *   published points exactly ($6,342 / ($89,490 − $47,210) = 0.15):
 *   https://www.canada.ca/en/revenue-agency/services/forms-publications/td1-personal-tax-credits-returns/td1-forms-pay-received-on-january-1-later/td1on.html
 * - Capital gains inclusion, one half:
 *   https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains.html
 * - TFSA dollar limit, $7,000 for 2026:
 *   https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributing/calculate-room.html
 */
export interface CaTaxBracket {
  /** Inclusive top of the bracket, in Canadian dollars. */
  upTo: number;
  rate: number;
}

export interface CaTaxTable {
  taxYear: number;
  province: "ON";
  provinceLabel: string;
  federalBrackets: readonly CaTaxBracket[];
  provincialBrackets: readonly CaTaxBracket[];
  federalCreditRate: number;
  provincialCreditRate: number;
  federalBasicPersonalMaximum: number;
  federalBasicPersonalMinimum: number;
  federalBasicPersonalPhaseOutStart: number;
  federalBasicPersonalPhaseOutEnd: number;
  provincialBasicPersonalAmount: number;
  federalAgeMaximum: number;
  federalAgeThreshold: number;
  federalAgeReductionRate: number;
  provincialAgeMaximum: number;
  provincialAgeThreshold: number;
  provincialAgeReductionRate: number;
  federalPensionAmount: number;
  provincialPensionAmount: number;
  /** Age at which the age amount and RRIF pension credit start. */
  ageAmountAge: number;
  oasRecoveryThreshold: number;
  oasRecoveryRate: number;
  ontarioSurtaxFirstThreshold: number;
  ontarioSurtaxFirstRate: number;
  ontarioSurtaxSecondThreshold: number;
  ontarioSurtaxSecondRate: number;
  capitalGainsInclusionRate: number;
  tfsaDollarLimit: number;
}

export const CA_ON_TAX_2026: CaTaxTable = {
  taxYear: 2026,
  province: "ON",
  provinceLabel: "Ontario",
  federalBrackets: [
    { upTo: 58_523, rate: 0.14 },
    { upTo: 117_045, rate: 0.205 },
    { upTo: 181_440, rate: 0.26 },
    { upTo: 258_482, rate: 0.29 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.33 },
  ],
  provincialBrackets: [
    { upTo: 53_891, rate: 0.0505 },
    { upTo: 107_785, rate: 0.0915 },
    { upTo: 150_000, rate: 0.1116 },
    { upTo: 220_000, rate: 0.1216 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.1316 },
  ],
  federalCreditRate: 0.14,
  provincialCreditRate: 0.0505,
  federalBasicPersonalMaximum: 16_452,
  federalBasicPersonalMinimum: 14_829,
  federalBasicPersonalPhaseOutStart: 181_440,
  federalBasicPersonalPhaseOutEnd: 258_482,
  provincialBasicPersonalAmount: 12_989,
  federalAgeMaximum: 9_208,
  federalAgeThreshold: 46_432,
  federalAgeReductionRate: 0.15,
  provincialAgeMaximum: 6_342,
  provincialAgeThreshold: 47_210,
  provincialAgeReductionRate: 0.15,
  federalPensionAmount: 2_000,
  provincialPensionAmount: 1_796,
  ageAmountAge: 65,
  oasRecoveryThreshold: 95_323,
  oasRecoveryRate: 0.15,
  ontarioSurtaxFirstThreshold: 5_818,
  ontarioSurtaxFirstRate: 0.2,
  ontarioSurtaxSecondThreshold: 7_446,
  ontarioSurtaxSecondRate: 0.36,
  capitalGainsInclusionRate: 0.5,
  tfsaDollarLimit: 7_000,
};

export const CA_TAX_SOURCES: readonly { label: string; url: string }[] = [
  {
    label: "CRA federal brackets, 2026",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html",
  },
  {
    label: "CRA TD1 and TD1-WS, 2026 (basic personal, age, and pension amounts)",
    url: "https://www.canada.ca/content/dam/cra-arc/formspubs/pbg/td1/td1-26e.pdf",
  },
  {
    label: "OAS recovery tax thresholds",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/recovery-tax.html",
  },
  {
    label: "CRA Ontario payroll tables, 2026 (brackets, surtax, health premium)",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables/t4032on-jan/t4032on-january-general-information.html",
  },
  {
    label: "CRA TD1ON, 2026 (Ontario age and pension amounts)",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/td1-personal-tax-credits-returns/td1-forms-pay-received-on-january-1-later/td1on.html",
  },
  {
    label: "CRA capital gains inclusion (one half)",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/personal-income/line-12700-capital-gains.html",
  },
  {
    label: "CRA TFSA dollar limit, 2026",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributing/calculate-room.html",
  },
];

/** Shown in the assumptions panel. Educational limits, not a filing checklist. */
export const CA_TAX_LIMITATIONS: readonly string[] = [
  "Ontario tax reduction (the low-income reduction on Form ON428) is not applied.",
  "The spouse or common-law partner amount is not applied.",
  "Annual non-registered distributions (interest and dividends) are not modeled. Only the gain assumed on a withdrawal is taxed. Dividend gross-up and the dividend tax credit are not applied.",
  "Alternative minimum tax, CPP contributions, and the Canada employment amount are not applied.",
  "OAS is the amount entered on the plan. The 10% increase at 75 and the GIS are not modeled. The recovery tax uses that OAS and 2026 net income.",
  "A pension you enter is treated as eligible pension income at any age. The plan cannot tell a life annuity from other pension income.",
  "RRSP withdrawals are not split. RRIF withdrawals are split with the pension-split percent only when both people are alive and the owner is 65 or older. The pension credit on RRIF income requires the person reporting it to be 65 or older.",
  "At the first death, registered accounts roll to the survivor with no tax. Tax on the remaining RRSP or RRIF, and on the assumed non-registered gain, is estimated only at the plan horizon.",
  "TFSA room is a flat annual amount per living person who already has a TFSA. Unused room and withdrawals are not tracked.",
  "Cash withdrawals are not taxed. A non-registered withdrawal is taxed as a capital gain using the unrealized-gain share and the inclusion rate.",
  "Provincial tax is Ontario only.",
  "The chart and the balance table still withdraw pro-rata and do not include this tax. This section is the tax estimate.",
];

export interface PersonTaxInput {
  age: number;
  /** Line 23400 style net income, including OAS, before the recovery deduction. */
  netIncomeBeforeClawback: number;
  oas: number;
  /** Eligible pension income before the $2,000 / $1,796 caps. */
  eligiblePension: number;
}

export interface PersonTaxResult {
  netIncomeBeforeClawback: number;
  oasClawback: number;
  taxableIncome: number;
  federalTax: number;
  /** Ontario tax after credits, plus surtax and the Ontario health premium. */
  provincialTax: number;
  totalTax: number;
}

export function taxFromBrackets(
  income: number,
  brackets: readonly CaTaxBracket[],
): number {
  if (income <= 0) return 0;
  let tax = 0;
  let previous = 0;
  for (const bracket of brackets) {
    const slice = Math.min(income, bracket.upTo) - previous;
    if (slice > 0) tax += slice * bracket.rate;
    if (income <= bracket.upTo) break;
    previous = bracket.upTo;
  }
  return tax;
}

/** Enhanced federal basic personal amount for 2026 net income. */
export function federalBasicPersonalAmount(
  netIncome: number,
  table: CaTaxTable = CA_ON_TAX_2026,
): number {
  if (netIncome <= table.federalBasicPersonalPhaseOutStart) {
    return table.federalBasicPersonalMaximum;
  }
  if (netIncome >= table.federalBasicPersonalPhaseOutEnd) {
    return table.federalBasicPersonalMinimum;
  }
  const span =
    table.federalBasicPersonalPhaseOutEnd -
    table.federalBasicPersonalPhaseOutStart;
  const drop = table.federalBasicPersonalMaximum - table.federalBasicPersonalMinimum;
  return (
    table.federalBasicPersonalMaximum -
    ((netIncome - table.federalBasicPersonalPhaseOutStart) * drop) / span
  );
}

export function ageCreditBase(
  netIncome: number,
  age: number,
  maximum: number,
  threshold: number,
  reductionRate: number,
  qualifyingAge: number,
): number {
  if (age < qualifyingAge || maximum <= 0) return 0;
  if (netIncome <= threshold) return maximum;
  return Math.max(0, maximum - (netIncome - threshold) * reductionRate);
}

/**
 * Ontario health premium for 2026 taxable income.
 * https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables/t4032on-jan/t4032on-january-general-information.html
 */
export function ontarioHealthPremium(taxableIncome: number): number {
  const income = Math.max(0, taxableIncome);
  if (income <= 20_000) return 0;
  if (income <= 36_000) return Math.min(300, 0.06 * (income - 20_000));
  if (income <= 48_000) return Math.min(450, 300 + 0.06 * (income - 36_000));
  if (income <= 72_000) return Math.min(600, 450 + 0.25 * (income - 48_000));
  if (income <= 200_000) return Math.min(750, 600 + 0.25 * (income - 72_000));
  return Math.min(900, 750 + 0.25 * (income - 200_000));
}

export function ontarioSurtax(
  basicProvincialTax: number,
  table: CaTaxTable = CA_ON_TAX_2026,
): number {
  const basic = Math.max(0, basicProvincialTax);
  if (basic <= table.ontarioSurtaxFirstThreshold) return 0;
  const first =
    table.ontarioSurtaxFirstRate * (basic - table.ontarioSurtaxFirstThreshold);
  if (basic <= table.ontarioSurtaxSecondThreshold) return first;
  return (
    first +
    table.ontarioSurtaxSecondRate * (basic - table.ontarioSurtaxSecondThreshold)
  );
}

/**
 * Federal tax, Ontario tax, and the OAS recovery tax for one person.
 * Amounts are Canadian dollars. A deceased person is not taxed here: this
 * model treats death as the start of the year and rolls registered accounts
 * to the survivor before the year runs.
 */
export function estimatePersonTax(
  input: PersonTaxInput,
  table: CaTaxTable = CA_ON_TAX_2026,
): PersonTaxResult {
  const netIncome = Math.max(0, input.netIncomeBeforeClawback);
  const oas = Math.max(0, input.oas);
  const clawback = Math.min(
    oas,
    Math.max(0, netIncome - table.oasRecoveryThreshold) * table.oasRecoveryRate,
  );
  const taxableIncome = Math.max(0, netIncome - clawback);

  const federalBase = federalBasicPersonalAmount(netIncome, table);
  const federalAge = ageCreditBase(
    netIncome,
    input.age,
    table.federalAgeMaximum,
    table.federalAgeThreshold,
    table.federalAgeReductionRate,
    table.ageAmountAge,
  );
  const federalPension = Math.min(
    table.federalPensionAmount,
    Math.max(0, input.eligiblePension),
  );
  const federalCredits =
    (federalBase + federalAge + federalPension) * table.federalCreditRate;
  const federalTax = Math.max(
    0,
    taxFromBrackets(taxableIncome, table.federalBrackets) - federalCredits,
  );

  const provincialAge = ageCreditBase(
    netIncome,
    input.age,
    table.provincialAgeMaximum,
    table.provincialAgeThreshold,
    table.provincialAgeReductionRate,
    table.ageAmountAge,
  );
  const provincialPension = Math.min(
    table.provincialPensionAmount,
    Math.max(0, input.eligiblePension),
  );
  const provincialCredits =
    (table.provincialBasicPersonalAmount + provincialAge + provincialPension) *
    table.provincialCreditRate;
  const basicProvincial = Math.max(
    0,
    taxFromBrackets(taxableIncome, table.provincialBrackets) - provincialCredits,
  );
  const surtax = ontarioSurtax(basicProvincial, table);
  const health = ontarioHealthPremium(taxableIncome);
  const provincialTax = basicProvincial + surtax + health;

  return {
    netIncomeBeforeClawback: netIncome,
    oasClawback: clawback,
    taxableIncome,
    federalTax,
    provincialTax,
    totalTax: federalTax + provincialTax + clawback,
  };
}

export interface CanadianTaxAssumptions {
  unrealizedGainShare: number;
  capitalGainsInclusionRate: number;
  /**
   * Canadian dollars per 1 stored plan dollar. Plan amounts are stored in USD.
   * 1 means the stored dollars are already Canadian dollars (the hand check).
   */
  cadPerUsd: number;
}

interface PersonAccumulator {
  id: RetirementPersonId;
  age: number;
  deceased: boolean;
  cpp: number;
  oas: number;
  pension: number;
  other: number;
  rrsp: number;
  rrif: number;
  taxableGain: number;
}

function otherPerson(id: RetirementPersonId): RetirementPersonId {
  return id === "person1" ? "person2" : "person1";
}

function clampShare(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Taxable capital gain on a non-registered withdrawal. Cash and TFSA are zero.
 * RRSP and RRIF withdrawals are fully included and are not handled here.
 */
export function taxableGainOnWithdrawal(
  kind: ProjectedAccountKind,
  withdrawal: number,
  unrealizedGainShare: number,
  inclusionRate: number,
): number {
  if (kind !== "non_registered" || withdrawal <= 0) return 0;
  return withdrawal * clampShare(unrealizedGainShare) * clampShare(inclusionRate);
}

/**
 * Household tax in stored plan dollars. Inputs are converted to Canadian
 * dollars, taxed, and converted back so the spending gap stays in stored dollars.
 */
export function estimateHouseholdTax(
  input: RetirementTaxYearInput,
  assumptions: CanadianTaxAssumptions,
  table: CaTaxTable = CA_ON_TAX_2026,
): { totalTax: number; people: RetirementTaxPersonDetail[] } {
  const fx = assumptions.cadPerUsd > 0 ? assumptions.cadPerUsd : 1;
  const toCad = (usd: number) => Math.max(0, usd) * fx;
  const toUsd = (cad: number) => (fx > 0 ? cad / fx : cad);

  const byId = new Map<RetirementPersonId, PersonAccumulator>();
  for (const person of input.people) {
    byId.set(person.id, {
      id: person.id,
      age: person.age,
      deceased: person.deceased,
      cpp: person.deceased ? 0 : toCad(person.cpp),
      oas: person.deceased ? 0 : toCad(person.oas),
      pension: person.deceased ? 0 : toCad(person.pensionAfterSplit),
      other: person.deceased ? 0 : toCad(person.other),
      rrsp: 0,
      rrif: 0,
      taxableGain: 0,
    });
  }

  const living = input.people.filter((person) => !person.deceased);
  const bothAlive = living.length >= 2;
  const split = bothAlive
    ? Math.min(0.5, Math.max(0, input.pensionSplitPercent / 100))
    : 0;

  for (const account of input.accounts) {
    const withdrawal = Math.max(0, account.withdrawal ?? 0);
    if (withdrawal <= 0) continue;
    const owner = byId.get(account.owner);
    if (!owner) continue;
    const amount = toCad(withdrawal);
    if (account.kind === "rrsp") {
      owner.rrsp += amount;
      continue;
    }
    if (account.kind === "rrif") {
      const ownerAge = owner.age;
      if (bothAlive && ownerAge >= table.ageAmountAge && split > 0) {
        const other = byId.get(otherPerson(owner.id));
        owner.rrif += amount * (1 - split);
        if (other && !other.deceased) other.rrif += amount * split;
        else owner.rrif += amount * split;
      } else {
        owner.rrif += amount;
      }
      continue;
    }
    owner.taxableGain += taxableGainOnWithdrawal(
      account.kind,
      amount,
      assumptions.unrealizedGainShare,
      assumptions.capitalGainsInclusionRate,
    );
  }

  const people: RetirementTaxPersonDetail[] = [];
  let totalTax = 0;
  for (const person of input.people) {
    const bucket = byId.get(person.id);
    if (!bucket || bucket.deceased) {
      people.push({
        id: person.id,
        age: person.age,
        netIncomeBeforeClawback: 0,
        taxableIncome: 0,
        federalTax: 0,
        provincialTax: 0,
        oasClawback: 0,
        totalTax: 0,
        oas: 0,
        eligiblePension: 0,
      });
      continue;
    }
    const eligiblePension =
      bucket.pension + (bucket.age >= table.ageAmountAge ? bucket.rrif : 0);
    const net =
      bucket.cpp +
      bucket.oas +
      bucket.pension +
      bucket.other +
      bucket.rrsp +
      bucket.rrif +
      bucket.taxableGain;
    const tax = estimatePersonTax(
      {
        age: bucket.age,
        netIncomeBeforeClawback: net,
        oas: bucket.oas,
        eligiblePension,
      },
      table,
    );
    const detail: RetirementTaxPersonDetail = {
      id: person.id,
      age: person.age,
      netIncomeBeforeClawback: toUsd(tax.netIncomeBeforeClawback),
      taxableIncome: toUsd(tax.taxableIncome),
      federalTax: toUsd(tax.federalTax),
      provincialTax: toUsd(tax.provincialTax),
      oasClawback: toUsd(tax.oasClawback),
      totalTax: toUsd(tax.totalTax),
      oas: toUsd(bucket.oas),
      eligiblePension: toUsd(eligiblePension),
    };
    totalTax += detail.totalTax;
    people.push(detail);
  }

  return { totalTax, people };
}

export function createCanadianTaxEngine(
  assumptions: CanadianTaxAssumptions,
  table: CaTaxTable = CA_ON_TAX_2026,
): RetirementTaxEngine {
  return (input) => {
    const detail = estimateHouseholdTax(input, assumptions, table);
    return { taxPayable: detail.totalTax, people: detail.people };
  };
}

/** Top of the lowest federal bracket. The meltdown target when the plan has none. */
export function lowestFederalBracketTop(
  table: CaTaxTable = CA_ON_TAX_2026,
): number {
  return table.federalBrackets[0]?.upTo ?? 0;
}
