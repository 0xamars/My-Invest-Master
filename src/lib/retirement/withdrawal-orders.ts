import { missingRetirementInputs } from "@/lib/retirement/inputs";
import { findDepletionYear, computeRetirementProjections } from "@/lib/retirement/projections";
import { normalizeRetirementPlan } from "@/lib/retirement/normalize";
import {
  CA_ON_TAX_2026,
  createCanadianTaxEngine,
  estimatePersonTax,
  lowestFederalBracketTop,
  taxableGainOnWithdrawal,
  taxTableForYear,
} from "@/lib/retirement/tax-ca";
import type { RetirementTaxYearResult } from "@/lib/retirement/tax-year";
import type {
  WithdrawalEngine,
  WithdrawalPersonInput,
  WithdrawalYearInput,
  WithdrawalYearResult,
} from "@/lib/retirement/withdrawal";
import {
  type ProjectedAccountKind,
  type RetirementPersonId,
  type RetirementPlan,
  type SurvivorScenario,
  type WithdrawalOrderId,
  type YearProjection,
} from "@/types/retirement";

/**
 * Owner rule, the same for every order after the RRIF minimum.
 * Draw from the person with the lower taxable income until it matches the
 * other person, then draw from both so the two taxable incomes rise together.
 * A tie starts with person 1. Within a tier, that person's accounts are drawn
 * pro-rata by balance. If one person has no balance left in the tier, the
 * other funds the rest. Taxable income is CPP + OAS + pension after the
 * pension split + other income + withdrawals already taken. RRSP and RRIF
 * count in full. A non-registered withdrawal counts as withdrawal ×
 * unrealized-gain share × inclusion rate. TFSA and cash count as zero, so
 * they do not close the income gap and stay with the lower-income person
 * until that person's tier is empty. A RRIF withdrawal is split with the
 * pension-split percent when both people are alive and the owner is 65 or older.
 */
export const WITHDRAWAL_OWNER_RULE =
  "After the RRIF minimum, draw from the person with the lower taxable income until it matches the other person, then draw from both so those incomes rise together. A tie starts with person 1. Accounts in the tier are drawn pro-rata by balance. If one person has no balance left in the tier, the other funds the rest.";

export interface WithdrawalOrderDetail {
  id: WithdrawalOrderId;
  label: string;
  summary: string;
}

export const WITHDRAWAL_ORDER_DETAILS: readonly WithdrawalOrderDetail[] = [
  {
    id: "rrsp-first",
    label: "RRSP first",
    summary:
      "RRSP and RRIF, then non-registered and cash, then TFSA. RRIF minimums are always taken first.",
  },
  {
    id: "tfsa-last",
    label: "TFSA last",
    summary:
      "Non-registered and cash, then RRSP and RRIF, then TFSA. This differs from RRSP first whenever a non-registered or cash balance is still available.",
  },
  {
    id: "non-registered-first",
    label: "Non-registered first",
    summary:
      "Non-registered and cash, then TFSA, then RRSP and RRIF. RRIF minimums are still withdrawn before that order.",
  },
  {
    id: "meltdown",
    label: "RRSP meltdown",
    summary:
      "Each retired year, draw RRSP and RRIF up to the target taxable income per person. Fund the rest of the gap from non-registered and cash, then TFSA. After-tax surplus goes to a TFSA up to the annual room, then non-registered.",
  },
];

const ORDER_TIERS: Record<
  Exclude<WithdrawalOrderId, "meltdown">,
  readonly (readonly ProjectedAccountKind[])[]
> = {
  "rrsp-first": [["rrsp", "rrif"], ["non_registered", "cash"], ["tfsa"]],
  "tfsa-last": [["non_registered", "cash"], ["rrsp", "rrif"], ["tfsa"]],
  "non-registered-first": [["non_registered", "cash"], ["tfsa"], ["rrsp", "rrif"]],
};

export interface WithdrawalOrderEngineAssumptions {
  unrealizedGainShare: number;
  capitalGainsInclusionRate: number;
  /**
   * Stored plan dollars per retired person. Null uses the indexed top of the
   * lowest federal bracket for the projection year.
   */
  meltdownTargetIncome: number | null;
  /**
   * Stored plan dollars per living person who already has a TFSA. Null uses
   * the indexed TFSA dollar limit for the projection year.
   */
  annualTfsaRoom: number | null;
  /** 0–50. Applied to RRIF withdrawals when the owner is 65 or older. */
  pensionSplitPercent: number;
  /** Percent. 3 means 3%. Used when the meltdown target or TFSA room is blank. */
  inflationRatePercent?: number;
  /** Canadian dollars per stored plan dollar. Defaults to 1. */
  cadPerUsd?: number;
}

const DRAW_EPSILON = 0.005;

function sumIds(values: Record<string, number>, ids: string[]): number {
  return ids.reduce((sum, id) => sum + Math.max(0, values[id] ?? 0), 0);
}

function addProRata(
  values: Record<string, number>,
  amount: number,
  ids: string[],
): void {
  if (amount <= 0 || ids.length === 0) return;
  const total = sumIds(values, ids);
  if (total > 0) {
    for (const id of ids) {
      const value = Math.max(0, values[id] ?? 0);
      values[id] = (values[id] ?? 0) + amount * (value / total);
    }
    return;
  }
  const share = amount / ids.length;
  for (const id of ids) {
    values[id] = (values[id] ?? 0) + share;
  }
}

function withdrawProRata(
  values: Record<string, number>,
  amount: number,
  ids: string[],
  taken: Record<string, number>,
): number {
  const total = sumIds(values, ids);
  const withdrawal = Math.min(Math.max(0, amount), Math.max(0, total));
  if (total <= 0 || withdrawal <= 0) return 0;
  const ratio = (total - withdrawal) / total;
  for (const id of ids) {
    const before = Math.max(0, values[id] ?? 0);
    const after = before * ratio;
    values[id] = after;
    taken[id] = (taken[id] ?? 0) + (before - after);
  }
  return withdrawal;
}

function taxableRate(
  kind: ProjectedAccountKind,
  assumptions: WithdrawalOrderEngineAssumptions,
): number {
  if (kind === "rrsp" || kind === "rrif") return 1;
  if (kind === "non_registered") {
    return (
      Math.min(1, Math.max(0, assumptions.unrealizedGainShare)) *
      Math.min(1, Math.max(0, assumptions.capitalGainsInclusionRate))
    );
  }
  return 0;
}

function resolvePeople(input: WithdrawalYearInput): WithdrawalPersonInput[] {
  if (input.people && input.people.length > 0) return input.people;
  const seen = new Set<RetirementPersonId>();
  const people: WithdrawalPersonInput[] = [];
  for (const account of input.accounts) {
    if (seen.has(account.owner)) continue;
    seen.add(account.owner);
    people.push({
      id: account.owner,
      age: 0,
      retired: true,
      deceased: false,
      cpp: 0,
      oas: 0,
      pension: 0,
      pensionAfterSplit: 0,
      other: 0,
    });
  }
  return people;
}

function applyOrderedWithdrawal(
  input: WithdrawalYearInput,
  order: WithdrawalOrderId,
  assumptions: WithdrawalOrderEngineAssumptions,
): WithdrawalYearResult {
  const people = resolvePeople(input);
  const byPerson = new Map(people.map((person) => [person.id, person]));
  const values: Record<string, number> = {};
  const taken: Record<string, number> = {};
  let contributionTotal = 0;

  for (const account of input.accounts) {
    const contribution = Math.max(0, account.contribution);
    values[account.id] = Math.max(0, account.value) + contribution;
    contributionTotal += contribution;
    taken[account.id] = 0;
  }

  const income: Record<RetirementPersonId, number> = { person1: 0, person2: 0 };
  for (const person of people) {
    if (person.deceased) continue;
    income[person.id] =
      Math.max(0, person.cpp) +
      Math.max(0, person.oas) +
      Math.max(0, person.pensionAfterSplit) +
      Math.max(0, person.other);
  }

  const living = people.filter((person) => !person.deceased);
  const bothAlive = living.length >= 2;
  const split = bothAlive
    ? Math.min(0.5, Math.max(0, assumptions.pensionSplitPercent / 100))
    : 0;
  const fx = assumptions.cadPerUsd != null && assumptions.cadPerUsd > 0 ? assumptions.cadPerUsd : 1;
  const yearTable = taxTableForYear(
    input.year ?? CA_ON_TAX_2026.taxYear,
    assumptions.inflationRatePercent ?? 0,
  );
  const meltdownTarget =
    assumptions.meltdownTargetIncome ?? lowestFederalBracketTop(yearTable) / fx;
  const tfsaRoom =
    assumptions.annualTfsaRoom ?? yearTable.tfsaDollarLimit / fx;

  const addTaxable = (
    owner: RetirementPersonId,
    kind: ProjectedAccountKind,
    amount: number,
  ) => {
    const rate = taxableRate(kind, assumptions);
    if (amount <= 0 || rate <= 0) return;
    const taxable = amount * rate;
    const ownerPerson = byPerson.get(owner);
    const canSplit =
      kind === "rrif" &&
      bothAlive &&
      split > 0 &&
      ownerPerson != null &&
      !ownerPerson.deceased &&
      ownerPerson.age >= 65;
    if (!canSplit) {
      income[owner] += taxable;
      return;
    }
    const other: RetirementPersonId = owner === "person1" ? "person2" : "person1";
    income[owner] += taxable * (1 - split);
    income[other] += taxable * split;
  };

  const attributeSince = (before: Record<string, number>) => {
    for (const account of input.accounts) {
      const delta = (taken[account.id] ?? 0) - (before[account.id] ?? 0);
      if (delta > 0) addTaxable(account.owner, account.kind, delta);
    }
  };

  let rrifMinimum = 0;
  for (const account of input.accounts) {
    if (account.kind !== "rrif") continue;
    const minimum = Math.max(0, account.rrifMinimum);
    const available = Math.max(0, values[account.id] ?? 0);
    const draw = Math.min(minimum, available);
    values[account.id] = available - draw;
    taken[account.id] = (taken[account.id] ?? 0) + draw;
    rrifMinimum += draw;
    addTaxable(account.owner, "rrif", draw);
  }

  const compareOwners = (a: RetirementPersonId, b: RetirementPersonId) => {
    const diff = income[a] - income[b];
    if (Math.abs(diff) > DRAW_EPSILON) return diff;
    if (a === b) return 0;
    return a === "person1" ? -1 : 1;
  };

  const idsFor = (
    owner: RetirementPersonId,
    kinds: readonly ProjectedAccountKind[],
  ): string[] =>
    input.accounts
      .filter(
        (account) =>
          account.owner === owner &&
          kinds.includes(account.kind) &&
          (values[account.id] ?? 0) > DRAW_EPSILON,
      )
      .map((account) => account.id);

  const marginalPerDollar = (owner: RetirementPersonId, kinds: readonly ProjectedAccountKind[]) => {
    const ids = idsFor(owner, kinds);
    const balance = sumIds(values, ids);
    if (balance <= 0) return { self: 0, other: 0, balance: 0 };
    let self = 0;
    let other = 0;
    for (const account of input.accounts) {
      if (!ids.includes(account.id)) continue;
      const weight = Math.max(0, values[account.id] ?? 0) / balance;
      const rate = taxableRate(account.kind, assumptions);
      const ownerPerson = byPerson.get(owner);
      const canSplit =
        account.kind === "rrif" &&
        bothAlive &&
        split > 0 &&
        ownerPerson != null &&
        !ownerPerson.deceased &&
        ownerPerson.age >= 65;
      if (canSplit) {
        self += weight * rate * (1 - split);
        other += weight * rate * split;
      } else {
        self += weight * rate;
      }
    }
    return { self, other, balance };
  };

  const drawOwner = (
    owner: RetirementPersonId,
    kinds: readonly ProjectedAccountKind[],
    amount: number,
  ): number => {
    const ownerIds = idsFor(owner, kinds);
    if (ownerIds.length === 0 || amount <= DRAW_EPSILON) return 0;
    const before = { ...taken };
    const drawn = withdrawProRata(values, amount, ownerIds, taken);
    if (drawn > DRAW_EPSILON) attributeSince(before);
    return drawn;
  };

  const drawTier = (
    kinds: readonly ProjectedAccountKind[],
    amount: number,
  ): number => {
    let remaining = Math.max(0, amount);
    let guard = 0;
    while (remaining > DRAW_EPSILON && guard < 16) {
      guard += 1;
      const owners = [
        ...new Set(
          input.accounts
            .filter(
              (account) =>
                kinds.includes(account.kind) &&
                (values[account.id] ?? 0) > DRAW_EPSILON,
            )
            .map((account) => account.owner),
        ),
      ].sort(compareOwners);
      if (owners.length === 0) break;
      if (owners.length === 1) {
        remaining -= drawOwner(owners[0], kinds, remaining);
        break;
      }
      const low = owners[0];
      const high = owners[1];
      const lowMargin = marginalPerDollar(low, kinds);
      const incomeGap = income[high] - income[low];
      const catchUp = lowMargin.self - lowMargin.other;
      if (incomeGap > DRAW_EPSILON && catchUp > DRAW_EPSILON) {
        const need = Math.min(remaining, incomeGap / catchUp, lowMargin.balance);
        const drawn = drawOwner(low, kinds, need);
        if (drawn <= DRAW_EPSILON) break;
        remaining -= drawn;
        continue;
      }
      const highMargin = marginalPerDollar(high, kinds);
      const lowCatch = lowMargin.self - lowMargin.other;
      const highCatch = highMargin.self - highMargin.other;
      if (lowCatch <= DRAW_EPSILON && highCatch <= DRAW_EPSILON) {
        const drawn = drawOwner(low, kinds, remaining);
        if (drawn <= DRAW_EPSILON) break;
        remaining -= drawn;
        continue;
      }
      if (lowCatch <= DRAW_EPSILON || highCatch <= DRAW_EPSILON) {
        const payer = lowCatch > DRAW_EPSILON ? low : high;
        const drawn = drawOwner(payer, kinds, remaining);
        if (drawn <= DRAW_EPSILON) break;
        remaining -= drawn;
        continue;
      }
      let fromLow = (remaining * highCatch) / (lowCatch + highCatch);
      let fromHigh = remaining - fromLow;
      if (fromLow > lowMargin.balance) {
        fromLow = lowMargin.balance;
        fromHigh = Math.min(highMargin.balance, remaining - fromLow);
      } else if (fromHigh > highMargin.balance) {
        fromHigh = highMargin.balance;
        fromLow = Math.min(lowMargin.balance, remaining - fromHigh);
      }
      const drawn = drawOwner(low, kinds, fromLow) + drawOwner(high, kinds, fromHigh);
      if (drawn <= DRAW_EPSILON) break;
      remaining -= drawn;
    }
    return Math.max(0, amount) - remaining;
  };

  const drawRegisteredToTarget = (owner: RetirementPersonId) => {
    const target = Math.max(0, meltdownTarget);
    let guard = 0;
    while (income[owner] < target - DRAW_EPSILON && guard < 6) {
      guard += 1;
      const room = target - income[owner];
      const rrspIds = idsFor(owner, ["rrsp"]);
      if (rrspIds.length > 0) {
        const before = { ...taken };
        const drawn = withdrawProRata(values, room, rrspIds, taken);
        if (drawn <= DRAW_EPSILON) break;
        attributeSince(before);
        continue;
      }
      const rrifIds = idsFor(owner, ["rrif"]);
      if (rrifIds.length === 0) break;
      const ownerPerson = byPerson.get(owner);
      const canSplit =
        bothAlive &&
        split > 0 &&
        ownerPerson != null &&
        ownerPerson.age >= 65;
      const kept = canSplit ? 1 - split : 1;
      const dollars = kept > DRAW_EPSILON ? room / kept : room;
      const before = { ...taken };
      const drawn = withdrawProRata(values, dollars, rrifIds, taken);
      if (drawn <= DRAW_EPSILON) break;
      attributeSince(before);
    }
  };

  const gap = Math.max(0, input.spendingGap);

  if (order === "meltdown") {
    const retired = people
      .filter((person) => person.retired && !person.deceased)
      .map((person) => person.id)
      .sort(compareOwners);
    for (const owner of retired) drawRegisteredToTarget(owner);

    let withdrawn = sumIds(taken, input.accounts.map((account) => account.id));
    if (withdrawn < gap - DRAW_EPSILON) {
      withdrawn += drawTier(["non_registered", "cash"], gap - withdrawn);
    }
    if (withdrawn < gap - DRAW_EPSILON) {
      drawTier(["tfsa"], gap - withdrawn);
    }
  } else {
    let remaining = gap - Math.min(rrifMinimum, gap);
    for (const tier of ORDER_TIERS[order]) {
      if (remaining <= DRAW_EPSILON) break;
      remaining -= drawTier(tier, remaining);
    }
  }

  const withdrawnTotal = sumIds(
    taken,
    input.accounts.map((account) => account.id),
  );
  const surplus =
    order === "meltdown"
      ? Math.max(0, withdrawnTotal - gap)
      : Math.max(0, rrifMinimum - gap);

  let rrifSurplusReinvested = 0;
  let rrifSurplusLeftPlan = surplus;

  if (surplus > DRAW_EPSILON && order === "meltdown") {
    let left = surplus;
    const depositOrder: RetirementPersonId[] = ["person1", "person2"];
    for (const owner of depositOrder) {
      if (left <= DRAW_EPSILON) break;
      const person = byPerson.get(owner);
      if (!person || person.deceased) continue;
      const tfsaIds = input.accounts
        .filter((account) => account.owner === owner && account.kind === "tfsa")
        .map((account) => account.id);
      if (tfsaIds.length === 0) continue;
      const deposit = Math.min(left, Math.max(0, tfsaRoom));
      if (deposit <= 0) continue;
      addProRata(values, deposit, tfsaIds);
      left -= deposit;
    }
    if (left > DRAW_EPSILON) {
      const destination = input.accounts
        .filter(
          (account) =>
            account.kind === "non_registered" || account.kind === "cash",
        )
        .map((account) => account.id);
      if (destination.length > 0) {
        addProRata(values, left, destination);
        left = 0;
      }
    }
    rrifSurplusReinvested = surplus - left;
    rrifSurplusLeftPlan = left;
  } else if (surplus > DRAW_EPSILON) {
    const nonRegisteredOrCash = input.accounts
      .filter(
        (account) => account.kind === "non_registered" || account.kind === "cash",
      )
      .map((account) => account.id);
    const tfsa = input.accounts
      .filter((account) => account.kind === "tfsa")
      .map((account) => account.id);
    const destination =
      nonRegisteredOrCash.length > 0
        ? nonRegisteredOrCash
        : tfsa.length > 0
          ? tfsa
          : [];
    if (destination.length > 0) {
      addProRata(values, surplus, destination);
      rrifSurplusReinvested = surplus;
      rrifSurplusLeftPlan = 0;
    }
  }

  const closingByAccount: Record<string, number> = {};
  for (const account of input.accounts) {
    closingByAccount[account.id] = Math.max(0, values[account.id] ?? 0);
  }

  return {
    closingByAccount,
    withdrawalByAccount: taken,
    contributionTotal,
    portfolioWithdrawal: gap,
    rrifMinimum,
    rrifSurplusReinvested,
    rrifSurplusLeftPlan,
  };
}

export function createWithdrawalOrderEngine(
  order: WithdrawalOrderId,
  assumptions: WithdrawalOrderEngineAssumptions,
): WithdrawalEngine {
  return (input) => applyOrderedWithdrawal(input, order, assumptions);
}

export interface ResolvedWithdrawalAssumptions {
  selectedOrder: WithdrawalOrderId;
  unrealizedGainShare: number;
  capitalGainsInclusionRate: number;
  meltdownTargetIncome: number;
  annualTfsaRoom: number;
  pensionSplitPercent: number;
  cadPerUsd: number;
  taxYear: number;
  province: "ON";
  provinceLabel: string;
  /** Percent. 3 means 3%. */
  inflationRatePercent: number;
}

export function resolveWithdrawalAssumptions(
  plan: Pick<
    RetirementPlan,
    "withdrawalAssumptions" | "pensionSplitPercent" | "inflationRate"
  >,
  cadPerUsd: number,
  currentYear = CA_ON_TAX_2026.taxYear,
): ResolvedWithdrawalAssumptions {
  const fx = cadPerUsd > 0 ? cadPerUsd : 1;
  const stored = plan.withdrawalAssumptions;
  const table = taxTableForYear(currentYear, plan.inflationRate ?? 0);
  return {
    selectedOrder: stored?.selectedOrder ?? "rrsp-first",
    unrealizedGainShare: stored?.unrealizedGainShare ?? 0.5,
    capitalGainsInclusionRate:
      stored?.capitalGainsInclusionRate ?? CA_ON_TAX_2026.capitalGainsInclusionRate,
    meltdownTargetIncome:
      stored?.meltdownTargetIncome ?? lowestFederalBracketTop(table) / fx,
    annualTfsaRoom: stored?.annualTfsaRoom ?? table.tfsaDollarLimit / fx,
    pensionSplitPercent: plan.pensionSplitPercent ?? 0,
    cadPerUsd: fx,
    taxYear: CA_ON_TAX_2026.taxYear,
    province: "ON",
    provinceLabel: CA_ON_TAX_2026.provinceLabel,
    inflationRatePercent: plan.inflationRate ?? 0,
  };
}

export interface WithdrawalKindAmounts {
  rrspRrif: number;
  tfsa: number;
  nonRegisteredCash: number;
}

export interface PersonWithdrawalYearRow {
  year: number;
  age: number;
  alive: boolean;
  withdrawals: WithdrawalKindAmounts;
  rrifMinimum: number;
  taxableIncome: number;
  federalTax: number;
  provincialTax: number;
  oasClawback: number;
  totalTax: number;
  /** False when this year's tax and withdrawal did not settle within $0.01. */
  converged: boolean;
}

export interface HouseholdWithdrawalYearRow {
  year: number;
  withdrawals: WithdrawalKindAmounts;
  rrifMinimum: number;
  taxableIncome: number;
  federalTax: number;
  provincialTax: number;
  oasClawback: number;
  totalTax: number;
  closingBalance: number;
  /** False when this year's tax and withdrawal did not settle within $0.01. */
  converged: boolean;
}

export interface WithdrawalOrderTotals {
  federalTax: number;
  provincialTax: number;
  oasClawback: number;
  totalTax: number;
  endingAfterTaxEstate: number;
  depletionYear: number | null;
}

export interface WithdrawalOrderComparison {
  id: WithdrawalOrderId;
  label: string;
  summary: string;
  rowsByPerson: Record<RetirementPersonId, PersonWithdrawalYearRow[]>;
  householdRows: HouseholdWithdrawalYearRow[];
  totals: WithdrawalOrderTotals;
}

export interface WithdrawalComparisonResult {
  /** `needs-input` when age or spending was never entered. Orders are empty. */
  status: "ready" | "needs-input";
  missing: Array<"age" | "spending">;
  orders: WithdrawalOrderComparison[];
  assumptions: ResolvedWithdrawalAssumptions;
}

export interface CompareWithdrawalOrdersOptions {
  currentYear: number;
  /**
   * Canadian dollars per stored plan dollar. Omit or pass 1 when the fixture
   * dollars are already Canadian dollars.
   */
  cadPerUsd?: number;
  survivor?: SurvivorScenario | null;
}

function emptyKinds(): WithdrawalKindAmounts {
  return { rrspRrif: 0, tfsa: 0, nonRegisteredCash: 0 };
}

function addKinds(target: WithdrawalKindAmounts, source: WithdrawalKindAmounts) {
  target.rrspRrif += source.rrspRrif;
  target.tfsa += source.tfsa;
  target.nonRegisteredCash += source.nonRegisteredCash;
}

function kindBucket(
  kind: ProjectedAccountKind,
  amount: number,
  target: WithdrawalKindAmounts,
) {
  if (amount <= 0) return;
  if (kind === "rrsp" || kind === "rrif") target.rrspRrif += amount;
  else if (kind === "tfsa") target.tfsa += amount;
  else target.nonRegisteredCash += amount;
}

function minimumTaken(account: WithdrawalYearInput["accounts"][number]): number {
  if (account.kind !== "rrif") return 0;
  const available = Math.max(0, account.value) + Math.max(0, account.contribution);
  return Math.min(Math.max(0, account.rrifMinimum), available);
}

interface YearTrace {
  input: WithdrawalYearInput;
  result: WithdrawalYearResult;
}

function endingAfterTaxEstate(
  projections: YearProjection[],
  withdrawalByYear: Map<number, YearTrace>,
  taxByYear: Map<number, RetirementTaxYearResult>,
  assumptions: ResolvedWithdrawalAssumptions,
): number {
  const last = projections[projections.length - 1];
  if (!last) return 0;
  const trace = withdrawalByYear.get(last.year);
  if (!trace) return last.closingBalance;
  const gross = Object.values(trace.result.closingByAccount).reduce(
    (sum, value) => sum + Math.max(0, value),
    0,
  );
  const tax = taxByYear.get(last.year);
  if (!tax?.people) return gross;

  const fx = assumptions.cadPerUsd > 0 ? assumptions.cadPerUsd : 1;
  const table = taxTableForYear(last.year, assumptions.inflationRatePercent);
  let rrsp = 0;
  let rrif = 0;
  let nonRegistered = 0;
  for (const account of trace.input.accounts) {
    const closing = Math.max(0, trace.result.closingByAccount[account.id] ?? 0);
    if (account.kind === "rrsp") rrsp += closing;
    else if (account.kind === "rrif") rrif += closing;
    else if (account.kind === "non_registered") nonRegistered += closing;
  }
  const gain = taxableGainOnWithdrawal(
    "non_registered",
    nonRegistered,
    assumptions.unrealizedGainShare,
    assumptions.capitalGainsInclusionRate,
  );
  const extra = rrsp + rrif + gain;
  if (extra <= 0) return gross;

  // Spousal rollover puts the household's remaining registered accounts and
  // the assumed non-registered gain on the second death. When both people
  // are alive at the horizon, the younger person is assumed to die second.
  // The same age uses person 1.
  const candidates = (trace.input.people ?? []).filter((person) => !person.deceased);
  const pool = candidates.length > 0 ? candidates : (trace.input.people ?? []);
  const second = [...pool].sort((a, b) => {
    if (a.age !== b.age) return a.age - b.age;
    return a.id === "person1" ? -1 : 1;
  })[0];
  if (!second) return gross;
  const person = tax.people.find((row) => row.id === second.id);
  if (!person) return gross;
  const eligibleExtra = second.age >= table.ageAmountAge ? rrif : 0;
  const withEstate = estimatePersonTax(
    {
      age: second.age,
      netIncomeBeforeClawback: (person.netIncomeBeforeClawback + extra) * fx,
      oas: person.oas * fx,
      eligiblePension: (person.eligiblePension + eligibleExtra) * fx,
    },
    table,
  );
  const estateTax = Math.max(0, withEstate.totalTax / fx - person.totalTax);
  return Math.max(0, gross - estateTax);
}

function compareOneOrder(
  plan: RetirementPlan,
  order: WithdrawalOrderId,
  assumptions: ResolvedWithdrawalAssumptions,
  options: CompareWithdrawalOrdersOptions,
): WithdrawalOrderComparison {
  const detail = WITHDRAWAL_ORDER_DETAILS.find((item) => item.id === order);
  const withdrawalByYear = new Map<number, YearTrace>();
  const taxByYear = new Map<number, RetirementTaxYearResult>();
  const engineAssumptions: WithdrawalOrderEngineAssumptions = {
    unrealizedGainShare: assumptions.unrealizedGainShare,
    capitalGainsInclusionRate: assumptions.capitalGainsInclusionRate,
    meltdownTargetIncome: plan.withdrawalAssumptions.meltdownTargetIncome,
    annualTfsaRoom: plan.withdrawalAssumptions.annualTfsaRoom,
    pensionSplitPercent: assumptions.pensionSplitPercent,
    inflationRatePercent: assumptions.inflationRatePercent,
    cadPerUsd: assumptions.cadPerUsd,
  };
  const taxEngine = createCanadianTaxEngine({
    unrealizedGainShare: assumptions.unrealizedGainShare,
    capitalGainsInclusionRate: assumptions.capitalGainsInclusionRate,
    cadPerUsd: assumptions.cadPerUsd,
    inflationRatePercent: assumptions.inflationRatePercent,
  });

  const projections = computeRetirementProjections(plan, {
    currentYear: options.currentYear,
    survivor: options.survivor,
    withdrawalEngine: (input) => {
      const result = applyOrderedWithdrawal(input, order, engineAssumptions);
      if (input.year != null) withdrawalByYear.set(input.year, { input, result });
      return result;
    },
    taxEngine: (input) => {
      const result = taxEngine(input);
      taxByYear.set(input.year, result);
      return result;
    },
  });

  const personIds: RetirementPersonId[] = plan.spouse
    ? ["person1", "person2"]
    : ["person1"];
  const rowsByPerson: Record<RetirementPersonId, PersonWithdrawalYearRow[]> = {
    person1: [],
    person2: [],
  };

  for (const projection of projections) {
    const trace = withdrawalByYear.get(projection.year);
    const tax = taxByYear.get(projection.year);
    for (const personId of personIds) {
      const withdrawals = emptyKinds();
      let rrifMinimum = 0;
      if (trace) {
        for (const account of trace.input.accounts) {
          if (account.owner !== personId) continue;
          kindBucket(
            account.kind,
            trace.result.withdrawalByAccount[account.id] ?? 0,
            withdrawals,
          );
          rrifMinimum += minimumTaken(account);
        }
      }
      const personTax = tax?.people?.find((person) => person.id === personId);
      const age =
        personId === "person1"
          ? projection.age
          : (projection.spouseAge ?? 0);
      rowsByPerson[personId].push({
        year: projection.year,
        age,
        alive: !projection.deceased.includes(personId),
        withdrawals,
        rrifMinimum,
        taxableIncome: personTax?.taxableIncome ?? 0,
        federalTax: personTax?.federalTax ?? 0,
        provincialTax: personTax?.provincialTax ?? 0,
        oasClawback: personTax?.oasClawback ?? 0,
        totalTax: personTax?.totalTax ?? 0,
        converged: projection.taxWithdrawalConverged,
      });
    }
  }

  const householdRows: HouseholdWithdrawalYearRow[] = projections.map(
    (projection, index) => {
      const withdrawals = emptyKinds();
      let rrifMinimum = 0;
      let taxableIncome = 0;
      let federalTax = 0;
      let provincialTax = 0;
      let oasClawback = 0;
      let totalTax = 0;
      for (const personId of personIds) {
        const row = rowsByPerson[personId][index];
        if (!row) continue;
        addKinds(withdrawals, row.withdrawals);
        rrifMinimum += row.rrifMinimum;
        taxableIncome += row.taxableIncome;
        federalTax += row.federalTax;
        provincialTax += row.provincialTax;
        oasClawback += row.oasClawback;
        totalTax += row.totalTax;
      }
      return {
        year: projection.year,
        withdrawals,
        rrifMinimum,
        taxableIncome,
        federalTax,
        provincialTax,
        oasClawback,
        totalTax,
        closingBalance: projection.closingBalance,
        converged: projection.taxWithdrawalConverged,
      };
    },
  );

  const totals = householdRows.reduce<WithdrawalOrderTotals>(
    (sum, row) => ({
      federalTax: sum.federalTax + row.federalTax,
      provincialTax: sum.provincialTax + row.provincialTax,
      oasClawback: sum.oasClawback + row.oasClawback,
      totalTax: sum.totalTax + row.totalTax,
      endingAfterTaxEstate: 0,
      depletionYear: null,
    }),
    {
      federalTax: 0,
      provincialTax: 0,
      oasClawback: 0,
      totalTax: 0,
      endingAfterTaxEstate: 0,
      depletionYear: null,
    },
  );
  totals.endingAfterTaxEstate = endingAfterTaxEstate(
    projections,
    withdrawalByYear,
    taxByYear,
    assumptions,
  );
  totals.depletionYear = findDepletionYear(projections);

  return {
    id: order,
    label: detail?.label ?? order,
    summary: detail?.summary ?? "",
    rowsByPerson,
    householdRows,
    totals,
  };
}

/**
 * Compare the four withdrawal orders. Calls `normalizeRetirementPlan` and
 * `computeRetirementProjections` for each order. Same inputs return the same
 * output. An empty account list returns empty rows and zero totals.
 * A missing age or spending amount returns `needs-input` and no order rows.
 */
export function compareWithdrawalOrders(
  raw: unknown,
  options: CompareWithdrawalOrdersOptions,
): WithdrawalComparisonResult {
  const plan = normalizeRetirementPlan(raw, { currentYear: options.currentYear });
  const assumptions = resolveWithdrawalAssumptions(
    plan,
    options.cadPerUsd ?? 1,
    options.currentYear,
  );
  const missing = missingRetirementInputs(plan);
  if (missing.length > 0) {
    return { status: "needs-input", missing, orders: [], assumptions };
  }
  const orders = WITHDRAWAL_ORDER_DETAILS.map((detail) =>
    compareOneOrder(plan, detail.id, assumptions, options),
  );
  return { status: "ready", missing: [], orders, assumptions };
}
