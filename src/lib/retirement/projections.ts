import {
  DEFAULT_CURRENT_AGE,
  DEFAULT_PLAN_END_AGE,
  ageInCalendarYear,
  type RetirementIncomeStream,
  type RetirementPlan,
  type RetirementPlanAsset,
  type YearProjection,
} from "@/types/retirement";

export const PROJECTION_HORIZON_YEARS = 30;

function cloneAssetValues(assets: RetirementPlanAsset[]): Record<string, number> {
  const values: Record<string, number> = {};
  for (const asset of assets) {
    values[asset.id] = asset.unitPrice * asset.quantity;
  }
  return values;
}

function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

function applyCashflow(
  values: Record<string, number>,
  amount: number,
  assetIds: string[],
): Record<string, number> {
  if (amount === 0 || assetIds.length === 0) return values;

  const total = sumValues(values);
  if (amount > 0) {
    if (total > 0) {
      return Object.fromEntries(
        Object.entries(values).map(([id, value]) => [
          id,
          value + amount * (value / total),
        ]),
      );
    }

    const share = amount / assetIds.length;
    const next = { ...values };
    for (const id of assetIds) {
      next[id] = (next[id] ?? 0) + share;
    }
    return next;
  }

  const withdrawal = Math.min(-amount, Math.max(0, total));
  if (total <= 0 || withdrawal <= 0) return values;

  const remaining = Math.max(0, total - withdrawal);
  const ratio = remaining / total;
  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => [id, value * ratio]),
  );
}

export function inflateFromToday(
  amountToday: number,
  inflationRatePercent: number,
  yearsFromNow: number,
): number {
  if (amountToday <= 0) return 0;
  if (yearsFromNow <= 0) return amountToday;
  return amountToday * (1 + inflationRatePercent / 100) ** yearsFromNow;
}

export function lifestyleSpendingForYear(
  plan: Pick<RetirementPlan, "retirementYear" | "annualLifestyleSpending" | "inflationRate">,
  year: number,
): number {
  if (year < plan.retirementYear) return 0;

  const yearsSinceRetirement = year - plan.retirementYear;
  return inflateFromToday(
    plan.annualLifestyleSpending,
    plan.inflationRate,
    yearsSinceRetirement,
  );
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
  plan: Pick<RetirementPlan, "currentAge" | "planEndAge">,
  currentYear: number,
): number {
  const currentAge = plan.currentAge ?? DEFAULT_CURRENT_AGE;
  const planEndAge = plan.planEndAge ?? DEFAULT_PLAN_END_AGE;
  return currentYear + Math.max(0, planEndAge - currentAge);
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
}

function growAssetValues(
  assets: RetirementPlanAsset[],
  assetValues: Record<string, number>,
  growthRates: ProjectionGrowthRates | undefined,
): { nextValues: Record<string, number>; assetAppreciation: number } {
  let assetAppreciation = 0;
  const nextValues: Record<string, number> = {};

  for (const asset of assets) {
    const startValue = assetValues[asset.id] ?? 0;
    const cagr = growthRates?.[asset.id] ?? asset.expectedCagr;
    const growth = startValue * (cagr / 100);
    assetAppreciation += growth;
    nextValues[asset.id] = Math.max(0, startValue + growth);
  }

  return { nextValues, assetAppreciation };
}

export function computeRetirementProjections(
  plan: RetirementPlan,
  options?: ComputeProjectionOptions,
): YearProjection[] {
  const currentYear = options?.currentYear ?? new Date().getFullYear();
  const endYear =
    options?.horizonYears != null
      ? currentYear + options.horizonYears
      : projectionEndYear(plan, currentYear);

  if (plan.assets.length === 0) {
    return [];
  }

  const assetIds = plan.assets.map((asset) => asset.id);
  const currentAge = plan.currentAge ?? DEFAULT_CURRENT_AGE;
  const contribution = Math.max(0, plan.annualContribution ?? 0);
  const streams = plan.incomeStreams ?? [];

  let assetValues = cloneAssetValues(plan.assets);
  const projections: YearProjection[] = [];

  for (let year = currentYear; year <= endYear; year += 1) {
    const age = ageInCalendarYear(currentAge, year, currentYear);
    const openingBalance = sumValues(assetValues);
    const { nextValues, assetAppreciation } = growAssetValues(
      plan.assets,
      assetValues,
      options?.growthRatesForYear?.(year) ?? options?.growthRates,
    );

    const balanceAfterAppreciation = sumValues(nextValues);
    const isRetired = year >= plan.retirementYear;
    const yearContribution = isRetired ? 0 : contribution;
    const afterContribution = applyCashflow(
      nextValues,
      yearContribution,
      assetIds,
    );

    const lifestyleSpending = lifestyleSpendingForYear(plan, year);
    const income = isRetired
      ? incomeForYear(streams, age, plan.inflationRate, year - currentYear)
      : 0;
    const portfolioWithdrawal = isRetired
      ? Math.max(0, lifestyleSpending - income)
      : 0;

    const afterSpending = applyCashflow(
      afterContribution,
      -portfolioWithdrawal,
      assetIds,
    );
    const closingBalance = sumValues(afterSpending);

    projections.push({
      year,
      age,
      openingBalance,
      assetAppreciation,
      balanceAfterAppreciation,
      contribution: yearContribution,
      lifestyleSpending,
      income,
      portfolioWithdrawal,
      closingBalance,
      assetBreakdown: { ...afterSpending },
    });

    assetValues = afterSpending;
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
  retirementYear: number,
): number | null {
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
