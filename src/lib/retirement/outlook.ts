import type { MonteCarloPercentileBand, MonteCarloResult } from "@/lib/retirement/monte-carlo";
import { applyRetirementPlanPatch } from "@/lib/retirement/normalize";
import type { RetirementPlan } from "@/types/retirement";

export type OutlookLifeKey = "bad" | "typical" | "good";
export type OutlookPercentileKey = "p10" | "p50" | "p90";

export interface OutlookLife {
  key: OutlookLifeKey;
  label: "Bad" | "Typical" | "Good";
  marketLabel: string;
  percentileKey: OutlookPercentileKey;
  depletionAge: number | null;
  lastsToTarget: boolean;
  lastsPastEnd: boolean;
}

export interface OutlookLives {
  bad: OutlookLife;
  typical: OutlookLife;
  good: OutlookLife;
}

export interface OutlookChartRow {
  age: number;
  bad: number;
  typical: number;
  good: number;
  spread: number;
}

const LIFE_COPY: Record<
  OutlookLifeKey,
  Pick<OutlookLife, "label" | "marketLabel" | "percentileKey">
> = {
  bad: {
    label: "Bad",
    marketLabel: "if markets are bad",
    percentileKey: "p10",
  },
  typical: {
    label: "Typical",
    marketLabel: "if markets are typical",
    percentileKey: "p50",
  },
  good: {
    label: "Good",
    marketLabel: "if markets are good",
    percentileKey: "p90",
  },
};

export function longevityFromPercentileBands(
  bands: MonteCarloPercentileBand[],
  percentileKey: OutlookPercentileKey,
  targetAge: number,
): Pick<OutlookLife, "depletionAge" | "lastsToTarget" | "lastsPastEnd"> {
  for (const band of bands) {
    if (band[percentileKey] <= 0) {
      return {
        depletionAge: band.age,
        lastsToTarget: band.age >= targetAge,
        lastsPastEnd: false,
      };
    }
  }

  const last = bands[bands.length - 1];
  return {
    depletionAge: null,
    lastsToTarget: last != null && last.age >= targetAge,
    lastsPastEnd: bands.length > 0,
  };
}

function toLife(
  key: OutlookLifeKey,
  bands: MonteCarloPercentileBand[],
  targetAge: number,
): OutlookLife {
  return {
    key,
    ...LIFE_COPY[key],
    ...longevityFromPercentileBands(bands, LIFE_COPY[key].percentileKey, targetAge),
  };
}

export function outlookLivesFromResult(
  result: MonteCarloResult | null | undefined,
  targetAge: number,
): OutlookLives | null {
  if (!result || result.percentiles.length === 0) return null;

  return {
    bad: toLife("bad", result.percentiles, targetAge),
    typical: toLife("typical", result.percentiles, targetAge),
    good: toLife("good", result.percentiles, targetAge),
  };
}

export function formatOutlookAge(life: OutlookLife, targetAge: number): string {
  if (life.lastsPastEnd || life.depletionAge == null) {
    return `Past ${targetAge}`;
  }
  return String(life.depletionAge);
}

/**
 * One-sentence read of the existing p10 / p50 lives. Does not invent a score.
 */
export function outlookSentence(
  lives: OutlookLives | null,
  targetAge: number,
): string {
  if (!lives) {
    return "Add holdings to see how long this plan lasts.";
  }

  if (lives.bad.lastsToTarget) {
    return "This plan lasts even when markets are bad.";
  }

  if (lives.typical.lastsToTarget) {
    return "This plan lasts in a typical market.";
  }

  const typicalAge = lives.typical.depletionAge ?? targetAge;
  const badAge = lives.bad.depletionAge ?? targetAge;
  return `In a typical market this plan lasts to age ${typicalAge}. In a bad one it runs out at age ${badAge}. You need it to ${targetAge}.`;
}

export function outlookChartRows(
  bands: MonteCarloPercentileBand[],
): OutlookChartRow[] {
  return bands.map((band) => ({
    age: band.age,
    bad: Math.max(0, band.p10),
    typical: Math.max(0, band.p50),
    good: Math.max(0, band.p90),
    spread: Math.max(0, band.p90 - band.p10),
  }));
}

export function outlookLeversDirty(
  plan: RetirementPlan,
  preview: RetirementPlan,
): boolean {
  return (
    plan.retirementAge !== preview.retirementAge ||
    plan.annualLifestyleSpending !== preview.annualLifestyleSpending ||
    plan.annualContribution !== preview.annualContribution
  );
}

export function nudgeRetirementAge(
  plan: RetirementPlan,
  delta: number,
  currentYear?: number,
): RetirementPlan {
  const nextAge = Math.min(
    plan.planEndAge,
    Math.max(plan.currentAge, plan.retirementAge + delta),
  );
  return applyRetirementPlanPatch(plan, { retirementAge: nextAge }, currentYear);
}

export function nudgeAnnualSpending(
  plan: RetirementPlan,
  direction: 1 | -1,
  currentYear?: number,
): RetirementPlan {
  const current = Math.max(0, plan.annualLifestyleSpending);
  const next =
    current === 0
      ? direction > 0
        ? 1_000
        : 0
      : Math.max(0, Math.round(current * (direction > 0 ? 1.1 : 0.9)));
  return applyRetirementPlanPatch(
    plan,
    { annualLifestyleSpending: next },
    currentYear,
  );
}

export function nudgeAnnualSavings(
  plan: RetirementPlan,
  direction: 1 | -1,
  currentYear?: number,
  step?: number,
): RetirementPlan {
  const extra =
    step ??
    (plan.annualContribution <= 0
      ? 6_000
      : Math.max(1_200, Math.round((plan.annualContribution * 0.25) / 500) * 500));
  const next = Math.max(0, plan.annualContribution + direction * extra);
  return applyRetirementPlanPatch(plan, { annualContribution: next }, currentYear);
}
