import { getPlanTotalValue, type RetirementPlan } from "@/types/retirement";
import { findFreedomCrossing } from "@/lib/retirement/freedom-path";
import { computeTargetNestEgg, presentValue } from "@/lib/retirement/target";
import {
  computeRetirementProjections,
  findDepletionAge,
  findDepletionYear,
  nestEggAtRetirement,
} from "@/lib/retirement/projections";
import type { MonteCarloResult } from "@/lib/retirement/monte-carlo";

export type RetirementVerdict = "ahead" | "on-track" | "behind" | "empty";

export interface RetirementDashboard {
  verdict: RetirementVerdict;
  currentPortfolio: number;
  targetNestEgg: number;
  annualSpending: number;
  withdrawalRate: number;
  projectedNestEgg: number | null;
  projectedNestEggToday: number | null;
  gapToday: number | null;
  depletionYear: number | null;
  depletionAge: number | null;
  lastsPastPlanEnd: boolean;
  planEndAge: number;
  successRate: number | null;
  yearsToRetirement: number;
  freedomYear: number | null;
  freedomAge: number | null;
  yearsToFreedom: number | null;
}

export function verdictFromGap(
  projectedNestEggToday: number,
  targetNestEgg: number,
): Exclude<RetirementVerdict, "empty"> {
  if (targetNestEgg <= 0) {
    return projectedNestEggToday > 0 ? "ahead" : "on-track";
  }
  const ratio = projectedNestEggToday / targetNestEgg;
  if (ratio >= 1.1) return "ahead";
  if (ratio >= 0.95) return "on-track";
  return "behind";
}

export function computeRetirementDashboard(
  plan: RetirementPlan,
  options?: {
    currentYear?: number;
    monteCarlo?: MonteCarloResult | null;
    projections?: ReturnType<typeof computeRetirementProjections>;
  },
): RetirementDashboard {
  const currentYear = options?.currentYear ?? new Date().getFullYear();
  const currentPortfolio = getPlanTotalValue(plan);
  const targetNestEgg = computeTargetNestEgg(
    plan.annualLifestyleSpending,
    plan.withdrawalRate,
  );
  const yearsToRetirement = Math.max(0, plan.retirementAge - plan.currentAge);

  const emptyFreedom = {
    freedomYear: null,
    freedomAge: null,
    yearsToFreedom: null,
  };

  if (plan.assets.length === 0) {
    return {
      verdict: "empty",
      currentPortfolio,
      targetNestEgg,
      annualSpending: plan.annualLifestyleSpending,
      withdrawalRate: plan.withdrawalRate,
      projectedNestEgg: null,
      projectedNestEggToday: null,
      gapToday: null,
      depletionYear: null,
      depletionAge: null,
      lastsPastPlanEnd: false,
      planEndAge: plan.planEndAge,
      successRate: null,
      yearsToRetirement,
      ...emptyFreedom,
    };
  }

  const projections =
    options?.projections ??
    computeRetirementProjections(plan, { currentYear });
  const projectedNestEgg = nestEggAtRetirement(projections, plan.retirementYear);
  const projectedNestEggToday =
    projectedNestEgg == null
      ? null
      : presentValue(projectedNestEgg, plan.inflationRate, yearsToRetirement);
  const gapToday =
    projectedNestEggToday == null ? null : projectedNestEggToday - targetNestEgg;
  const depletionYear = findDepletionYear(projections);
  const depletionAge = findDepletionAge(projections);
  const freedom = findFreedomCrossing(plan, { currentYear });
  const yearsToFreedom =
    freedom == null ? null : Math.max(0, freedom.year - currentYear);

  const gapVerdict =
    projectedNestEggToday == null
      ? "behind"
      : verdictFromGap(projectedNestEggToday, targetNestEgg);
  const verdict =
    targetNestEgg <= 0
      ? gapVerdict
      : freedom == null
        ? "behind"
        : freedom.age + 2 < plan.retirementAge
          ? "ahead"
          : freedom.age <= plan.retirementAge
            ? "on-track"
            : "behind";

  return {
    verdict,
    currentPortfolio,
    targetNestEgg,
    annualSpending: plan.annualLifestyleSpending,
    withdrawalRate: plan.withdrawalRate,
    projectedNestEgg,
    projectedNestEggToday,
    gapToday,
    depletionYear,
    depletionAge,
    lastsPastPlanEnd: depletionYear === null,
    planEndAge: plan.planEndAge,
    successRate: options?.monteCarlo?.successRate ?? null,
    yearsToRetirement,
    freedomYear: freedom?.year ?? null,
    freedomAge: freedom?.age ?? null,
    yearsToFreedom,
  };
}
