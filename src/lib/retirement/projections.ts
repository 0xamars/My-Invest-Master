import type { RetirementPlan, RetirementPlanAsset, YearProjection } from "@/types/retirement";

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

function applySpending(
  values: Record<string, number>,
  spending: number,
): Record<string, number> {
  const total = sumValues(values);
  if (total <= 0 || spending <= 0) return values;

  const remaining = Math.max(0, total - spending);
  const ratio = remaining / total;

  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => [id, value * ratio]),
  );
}

function lifestyleSpendingForYear(
  plan: RetirementPlan,
  year: number,
): number {
  if (year < plan.retirementYear) return 0;

  const yearsSinceRetirement = year - plan.retirementYear;
  return (
    plan.annualLifestyleSpending *
    (1 + plan.inflationRate / 100) ** yearsSinceRetirement
  );
}

export function computeRetirementProjections(
  plan: RetirementPlan,
  options?: { horizonYears?: number },
): YearProjection[] {
  const currentYear = new Date().getFullYear();
  const endYear = currentYear + (options?.horizonYears ?? PROJECTION_HORIZON_YEARS);

  if (plan.assets.length === 0) {
    return [];
  }

  let assetValues = cloneAssetValues(plan.assets);
  const projections: YearProjection[] = [];

  for (let year = currentYear; year <= endYear; year += 1) {
    const openingBalance = sumValues(assetValues);
    let assetAppreciation = 0;
    const nextValues: Record<string, number> = {};

    for (const asset of plan.assets) {
      const startValue = assetValues[asset.id] ?? 0;
      const growth = startValue * (asset.expectedCagr / 100);
      assetAppreciation += growth;
      nextValues[asset.id] = startValue + growth;
    }

    const balanceAfterAppreciation = sumValues(nextValues);
    const lifestyleSpending = lifestyleSpendingForYear(plan, year);

    const afterSpending = applySpending(nextValues, lifestyleSpending);
    const closingBalance = sumValues(afterSpending);

    projections.push({
      year,
      openingBalance,
      assetAppreciation,
      balanceAfterAppreciation,
      lifestyleSpending,
      closingBalance,
      assetBreakdown: { ...afterSpending },
    });

    assetValues = afterSpending;
  }

  return projections;
}

export function getProjectionChartYears(
  horizonYears: number = PROJECTION_HORIZON_YEARS,
): number {
  return horizonYears;
}
