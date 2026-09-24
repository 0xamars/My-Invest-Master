import {
  activeSurvivor,
  ageInYear,
  householdDrawStartYear,
  householdEndYear,
  householdIncomeForYear,
  isDeceasedInYear,
  modeledPeople,
  personById,
  survivorOf,
} from "@/lib/retirement/household";
import { inflateFromToday } from "@/lib/retirement/inflate";
import {
  rrifMinimumAmount,
  rrspAlreadyDue,
  rrspConvertsAtYearEnd,
} from "@/lib/retirement/rrif";
import { retirementPlanReady } from "@/lib/retirement/inputs";
import { taxPayableFrom, type RetirementTaxEngine } from "@/lib/retirement/tax-year";
import {
  applyProRataWithdrawal,
  type WithdrawalEngine,
  type WithdrawalYearResult,
} from "@/lib/retirement/withdrawal";
import {
  defaultAccountKind,
  emptyPersonIncome,
  isAccountKind,
  type ProjectedAccountKind,
  type RetirementAccountKind,
  type RetirementIncomeStream,
  type RetirementPersonId,
  type RetirementPlan,
  type RetirementPlanAsset,
  type SurvivorScenario,
  type YearProjection,
} from "@/types/retirement";

export const PROJECTION_HORIZON_YEARS = 30;

function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

/**
 * Fixed-point cap for tax that depends on the withdrawal that pays the tax.
 * At a combined marginal rate near 68%, 16 plain iterations can leave about
 * $100 unresolved. 64 iterations close that gap, and a bisection finishes
 * any remainder.
 */
const TAX_WITHDRAWAL_ITERATIONS = 64;
const TAX_WITHDRAWAL_TOLERANCE = 0.01;

function withdrawalsClose(
  left: Record<string, number>,
  right: Record<string, number>,
): boolean {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const id of ids) {
    if (Math.abs((left[id] ?? 0) - (right[id] ?? 0)) > TAX_WITHDRAWAL_TOLERANCE) {
      return false;
    }
  }
  return true;
}

export { inflateFromToday } from "@/lib/retirement/inflate";

export function lifestyleSpendingForYear(
  plan: Pick<
    RetirementPlan,
    | "currentAge"
    | "retirementAge"
    | "retirementYear"
    | "annualLifestyleSpending"
    | "inflationRate"
    | "spouse"
  >,
  year: number,
  currentYear: number,
): number {
  const spending = plan.annualLifestyleSpending;
  if (spending == null || !Number.isFinite(spending)) return 0;

  const people = plan.spouse ? modeledPeople(plan, currentYear) : [];
  const drawStart = plan.spouse
    ? people.length === 0
      ? null
      : householdDrawStartYear(people)
    : plan.retirementYear;
  if (drawStart == null || !Number.isFinite(drawStart) || year < drawStart) return 0;

  return inflateFromToday(spending, plan.inflationRate, year - drawStart);
}

export function incomeForYear(
  streams: RetirementIncomeStream[],
  age: number,
  inflationRatePercent: number,
  yearsFromNow: number,
): number {
  let total = 0;
  for (const stream of streams) {
    if (age < stream.startAge || stream.annualAmount <= 0) continue;
    total += stream.colaWithInflation
      ? inflateFromToday(stream.annualAmount, inflationRatePercent, yearsFromNow)
      : stream.annualAmount;
  }
  return total;
}

export function projectionEndYear(
  plan: Pick<RetirementPlan, "currentAge" | "planEndAge" | "spouse">,
  currentYear: number,
): number {
  return householdEndYear(plan, currentYear);
}

export interface ProjectionGrowthRates {
  [assetId: string]: number;
}

export interface ComputeProjectionOptions {
  horizonYears?: number;
  currentYear?: number;
  /** Annual return percent keyed by asset id. Defaults to each asset's expectedCagr. */
  growthRates?: ProjectionGrowthRates;
  /** When set, sampled once per year (Monte Carlo). Overrides growthRates. */
  growthRatesForYear?: (year: number) => ProjectionGrowthRates;
  /** Household path if one person dies at a chosen age. Ignored without a spouse. */
  survivor?: SurvivorScenario | null;
  /** Replaces the pro-rata withdrawal step. RRIF minimums are still supplied. */
  withdrawalEngine?: WithdrawalEngine;
  /** Adds tax to the spending gap. The default returns 0. */
  taxEngine?: RetirementTaxEngine;
}

interface RunningAccount {
  id: string;
  owner: RetirementPersonId;
  contributionOwner: RetirementPersonId;
  storedKind: RetirementAccountKind;
  converted: boolean;
  value: number;
  annualContribution: number;
  expectedCagr: number;
}

function resolveAccounts(
  assets: RetirementPlanAsset[],
  hasSpouse: boolean,
): RunningAccount[] {
  return assets.map((asset) => {
    const owner: RetirementPersonId =
      hasSpouse && asset.owner === "person2" ? "person2" : "person1";
    return {
      id: asset.id,
      owner,
      contributionOwner: owner,
      storedKind: isAccountKind(asset.accountKind)
        ? asset.accountKind
        : defaultAccountKind(asset.type),
      converted: false,
      value: Math.max(0, asset.unitPrice * asset.quantity),
      annualContribution: Number.isFinite(asset.annualContribution)
        ? Math.max(0, asset.annualContribution)
        : 0,
      expectedCagr: asset.expectedCagr,
    };
  });
}

function projectedKind(account: RunningAccount): ProjectedAccountKind {
  if (account.storedKind !== "rrsp") return account.storedKind;
  return account.converted ? "rrif" : "rrsp";
}

function addProRata(
  extras: Record<string, number>,
  base: Record<string, number>,
  amount: number,
  ids: string[],
): void {
  if (amount <= 0 || ids.length === 0) return;
  const total = ids.reduce((sum, id) => sum + Math.max(0, base[id] ?? 0), 0);
  if (total > 0) {
    for (const id of ids) {
      extras[id] = (extras[id] ?? 0) + amount * (Math.max(0, base[id] ?? 0) / total);
    }
    return;
  }
  const share = amount / ids.length;
  for (const id of ids) {
    extras[id] = (extras[id] ?? 0) + share;
  }
}

export function computeRetirementProjections(
  plan: RetirementPlan,
  options?: ComputeProjectionOptions,
): YearProjection[] {
  if (!retirementPlanReady(plan)) return [];

  const currentYear = options?.currentYear ?? new Date().getFullYear();
  const endYear =
    options?.horizonYears != null
      ? currentYear + options.horizonYears
      : projectionEndYear(plan, currentYear);

  if (plan.assets.length === 0) {
    return [];
  }

  const people = modeledPeople(plan, currentYear);
  const byId = personById(people);
  const person1 = byId.person1;
  if (!person1) return [];

  const scenario = activeSurvivor(plan, options?.survivor);
  const drawStart = householdDrawStartYear(people);
  const withdraw = options?.withdrawalEngine ?? applyProRataWithdrawal;
  const accounts = resolveAccounts(plan.assets, Boolean(plan.spouse));
  const streams = plan.incomeStreams ?? [];
  const planContribution = Math.max(0, plan.annualContribution ?? 0);
  const projections: YearProjection[] = [];

  for (let year = currentYear; year <= endYear; year += 1) {
    if (scenario) {
      for (const account of accounts) {
        const owner = byId[account.owner];
        if (!owner) continue;
        if (isDeceasedInYear(owner, year, scenario, currentYear)) {
          account.owner = survivorOf(account.owner);
        }
      }
    }

    for (const account of accounts) {
      if (account.storedKind !== "rrsp") continue;
      const owner = byId[account.owner];
      if (!owner) continue;
      const age = ageInYear(owner, year, currentYear);
      if (rrspAlreadyDue(age, account.converted)) account.converted = true;
    }

    const openingValues: Record<string, number> = {};
    const accountKindById: Record<string, ProjectedAccountKind> = {};
    const minimumById: Record<string, number> = {};
    for (const account of accounts) {
      openingValues[account.id] = account.value;
      const owner = byId[account.owner];
      const age = owner ? ageInYear(owner, year, currentYear) : 0;
      accountKindById[account.id] = projectedKind(account);
      minimumById[account.id] =
        accountKindById[account.id] === "rrif"
          // CRA uses age at the start of the year. `age` is the age attained this year.
          ? rrifMinimumAmount(account.value, age - 1)
          : 0;
    }

    const openingBalance = sumValues(openingValues);
    const growthRates = options?.growthRatesForYear?.(year) ?? options?.growthRates;
    let assetAppreciation = 0;
    const afterGrowth: Record<string, number> = {};
    for (const account of accounts) {
      const startValue = account.value;
      const cagr = growthRates?.[account.id] ?? account.expectedCagr;
      const growth = startValue * (cagr / 100);
      assetAppreciation += growth;
      afterGrowth[account.id] = Math.max(0, startValue + growth);
    }
    const balanceAfterAppreciation = sumValues(afterGrowth);

    const deceased = people
      .filter((person) => isDeceasedInYear(person, year, scenario, currentYear))
      .map((person) => person.id);

    const contributionById: Record<string, number> = {};
    // Reported total is the amount we decided to add. Summing the pro-rata
    // shares can drift by an ulp, which would disagree with the single-person
    // engine that records the plan contribution itself.
    let intendedContribution = 0;
    for (const account of accounts) {
      const contributor = byId[account.contributionOwner];
      const contributorDead =
        contributor != null &&
        isDeceasedInYear(contributor, year, scenario, currentYear);
      const contributorRetired =
        contributor != null && year >= contributor.retirementYear;
      const amount =
        contributorDead || contributorRetired ? 0 : account.annualContribution;
      contributionById[account.id] = amount;
      intendedContribution += amount;
    }

    const person1Dead = deceased.includes("person1");
    if (!person1Dead && year < person1.retirementYear && planContribution > 0) {
      const person1Ids = accounts
        .filter((account) => account.owner === "person1")
        .map((account) => account.id);
      if (person1Ids.length > 0) {
        addProRata(contributionById, afterGrowth, planContribution, person1Ids);
        intendedContribution += planContribution;
      }
    }

    const income = householdIncomeForYear({
      streams,
      people,
      year,
      currentYear,
      inflationRatePercent: plan.inflationRate,
      pensionSplitPercent: plan.pensionSplitPercent ?? 0,
      scenario,
    });
    const lifestyleSpending = lifestyleSpendingForYear(plan, year, currentYear);
    const drawing = year >= drawStart;

    const taxPeople = people.map((person) => {
      const bucket = income.byPerson[person.id];
      return {
        id: person.id,
        age: ageInYear(person, year, currentYear),
        retired: year >= person.retirementYear,
        deceased: deceased.includes(person.id),
        cpp: bucket.cpp,
        oas: bucket.oas,
        pension: bucket.pension,
        pensionAfterSplit: bucket.pensionAfterSplit,
        other: bucket.other,
      };
    });

    const callWithdraw = (spendingGap: number): WithdrawalYearResult =>
      withdraw({
        spendingGap,
        year,
        people: taxPeople,
        accounts: accounts.map((account) => ({
          id: account.id,
          owner: account.owner,
          kind: accountKindById[account.id],
          value: afterGrowth[account.id] ?? 0,
          contribution: contributionById[account.id] ?? 0,
          rrifMinimum: minimumById[account.id] ?? 0,
        })),
      });

    const taxInputFor = (withdrawalByAccount: Record<string, number>) => ({
      year,
      spending: lifestyleSpending,
      pensionSplitPercent: plan.pensionSplitPercent ?? 0,
      people: taxPeople,
      accounts: accounts.map((account) => ({
        id: account.id,
        owner: account.owner,
        kind: accountKindById[account.id],
        openingValue: openingValues[account.id] ?? 0,
        rrifMinimum: minimumById[account.id] ?? 0,
        contribution: contributionById[account.id] ?? 0,
        withdrawal: withdrawalByAccount[account.id] ?? 0,
      })),
    });

    // Tax depends on how much registered money is withdrawn, and the gap
    // depends on tax. With no tax engine, or before withdrawals start, one
    // pass matches the previous projection. Otherwise a bounded fixed point
    // repeats until the withdrawal and the tax agree.
    let taxPayable = 0;
    let taxWithdrawalConverged = true;
    let settled: WithdrawalYearResult;
    if (!options?.taxEngine || !drawing) {
      taxPayable = taxPayableFrom(options?.taxEngine, taxInputFor({}));
      const spendingGap = drawing
        ? Math.max(0, lifestyleSpending + taxPayable - income.total)
        : 0;
      settled = callWithdraw(spendingGap);
    } else {
      const taxEngine = options.taxEngine;
      const evaluate = (guess: number) => {
        const spendingGap = Math.max(0, lifestyleSpending + guess - income.total);
        const nextSettled = callWithdraw(spendingGap);
        const raw = taxEngine(taxInputFor(nextSettled.withdrawalByAccount)).taxPayable;
        const nextTax = !Number.isFinite(raw) || raw <= 0 ? 0 : raw;
        return { nextTax, nextSettled, spendingGap };
      };

      let guess = 0;
      let resolved = evaluate(guess);
      taxWithdrawalConverged = false;
      for (let iteration = 0; iteration < TAX_WITHDRAWAL_ITERATIONS; iteration += 1) {
        const next = evaluate(guess);
        const stable =
          Math.abs(next.nextTax - guess) <= TAX_WITHDRAWAL_TOLERANCE &&
          withdrawalsClose(
            resolved.nextSettled.withdrawalByAccount,
            next.nextSettled.withdrawalByAccount,
          );
        resolved = next;
        if (stable) {
          taxWithdrawalConverged = true;
          break;
        }
        guess = next.nextTax;
      }

      if (!taxWithdrawalConverged) {
        let low = 0;
        let high = Math.max(guess, lifestyleSpending, 1);
        let highEval = evaluate(high);
        for (let expand = 0; expand < 24 && highEval.nextTax > high + TAX_WITHDRAWAL_TOLERANCE; expand += 1) {
          high *= 2;
          highEval = evaluate(high);
        }
        let lowEval = evaluate(low);
        for (let step = 0; step < 60; step += 1) {
          const mid = (low + high) / 2;
          const midEval = evaluate(mid);
          resolved = midEval;
          if (Math.abs(midEval.nextTax - mid) <= TAX_WITHDRAWAL_TOLERANCE) {
            taxWithdrawalConverged = true;
            break;
          }
          if (midEval.nextTax > mid) {
            low = mid;
            lowEval = midEval;
          } else {
            high = mid;
            highEval = midEval;
          }
          if (high - low <= TAX_WITHDRAWAL_TOLERANCE) {
            const lowGap = Math.abs(lowEval.nextTax - low);
            const highGap = Math.abs(highEval.nextTax - high);
            resolved = lowGap <= highGap ? lowEval : highEval;
            taxWithdrawalConverged =
              Math.min(lowGap, highGap) <= TAX_WITHDRAWAL_TOLERANCE;
            break;
          }
        }
      }

      taxPayable = resolved.nextTax;
      settled = resolved.nextSettled;
    }

    for (const account of accounts) {
      account.value = settled.closingByAccount[account.id] ?? 0;
      const owner = byId[account.owner];
      if (!owner || account.storedKind !== "rrsp") continue;
      const age = ageInYear(owner, year, currentYear);
      if (rrspConvertsAtYearEnd(age, account.converted)) account.converted = true;
    }

    const spouse = byId.person2;
    projections.push({
      year,
      age: ageInYear(person1, year, currentYear),
      spouseAge: spouse ? ageInYear(spouse, year, currentYear) : null,
      deceased,
      openingBalance,
      assetAppreciation,
      balanceAfterAppreciation,
      contribution: intendedContribution,
      lifestyleSpending,
      income: drawing ? income.total : 0,
      incomeByPerson: drawing
        ? income.byPerson
        : { person1: emptyPersonIncome(), person2: emptyPersonIncome() },
      taxPayable: drawing ? taxPayable : 0,
      taxWithdrawalConverged: drawing ? taxWithdrawalConverged : true,
      portfolioWithdrawal: settled.portfolioWithdrawal,
      rrifMinimum: settled.rrifMinimum,
      rrifSurplusReinvested: settled.rrifSurplusReinvested,
      rrifSurplusLeftPlan: settled.rrifSurplusLeftPlan,
      closingBalance: sumValues(settled.closingByAccount),
      assetBreakdown: { ...settled.closingByAccount },
      accountKindById,
    });
  }

  return projections;
}

export function findDepletionYear(
  projections: YearProjection[],
): number | null {
  for (const projection of projections) {
    if (projection.closingBalance <= 0) {
      return projection.year;
    }
  }
  return null;
}

export function findDepletionAge(
  projections: YearProjection[],
): number | null {
  for (const projection of projections) {
    if (projection.closingBalance <= 0) {
      return projection.age;
    }
  }
  return null;
}

export function nestEggAtRetirement(
  projections: YearProjection[],
  retirementYear: number | null,
): number | null {
  if (retirementYear == null) return null;
  const atRetirement = projections.find((row) => row.year === retirementYear);
  if (atRetirement) return atRetirement.closingBalance;
  const lastPre = [...projections]
    .reverse()
    .find((row) => row.year < retirementYear);
  return lastPre?.closingBalance ?? projections[0]?.openingBalance ?? null;
}

export function getProjectionChartYears(
  horizonYears: number = PROJECTION_HORIZON_YEARS,
): number {
  return horizonYears;
}
