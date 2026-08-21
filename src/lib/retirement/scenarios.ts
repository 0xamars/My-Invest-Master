import { applyRetirementPlanPatch } from "@/lib/retirement/normalize";
import {
  formatOutlookAge,
  outlookLivesFromResult,
} from "@/lib/retirement/outlook";
import {
  findDepletionAge,
  nestEggAtRetirement,
  computeRetirementProjections,
} from "@/lib/retirement/projections";
import { runRetirementMonteCarlo } from "@/lib/retirement/monte-carlo";
import type { RetirementPlan } from "@/types/retirement";

export type RetirementScenarioId =
  | "base"
  | "retire-earlier"
  | "retire-later"
  | "spend-less"
  | "spend-more"
  | "save-less"
  | "save-more";

export interface RetirementScenario {
  id: RetirementScenarioId;
  label: string;
  description: string;
  patch: Partial<RetirementPlan>;
}

export interface ScenarioComparison {
  id: RetirementScenarioId;
  label: string;
  description: string;
  nestEggAtRetirement: number | null;
  successRate: number | null;
  depletionAge: number | null;
  lastsPastPlanEnd: boolean;
  typicalAgeLabel: string | null;
  typicalLastsToTarget: boolean;
  plan: RetirementPlan;
}

export function defaultExtraAnnualSavings(currentContribution: number): number {
  if (!Number.isFinite(currentContribution) || currentContribution <= 0) {
    return 6_000;
  }
  const extra = Math.round((currentContribution * 0.25) / 500) * 500;
  return Math.max(1_200, extra);
}

export function buildWhatIfScenarios(plan: RetirementPlan): RetirementScenario[] {
  const extra = defaultExtraAnnualSavings(plan.annualContribution);
  const earlierAge = Math.max(plan.currentAge, plan.retirementAge - 2);
  const laterAge = Math.min(plan.planEndAge, plan.retirementAge + 2);
  const spendLess = Math.max(0, Math.round(plan.annualLifestyleSpending * 0.9));
  const spendMore =
    plan.annualLifestyleSpending <= 0
      ? 1_000
      : Math.round(plan.annualLifestyleSpending * 1.1);
  const saveLess = Math.max(0, plan.annualContribution - extra);
  const saveMore = plan.annualContribution + extra;

  return [
    {
      id: "retire-earlier",
      label: "Go 2 years earlier",
      description: `Target age ${earlierAge} instead of ${plan.retirementAge}.`,
      patch: { retirementAge: earlierAge },
    },
    {
      id: "retire-later",
      label: "Go 2 years later",
      description: `Target age ${laterAge} instead of ${plan.retirementAge}.`,
      patch: { retirementAge: laterAge },
    },
    {
      id: "spend-less",
      label: "Spend 10% less",
      description: "Cut annual lifestyle spending by 10%.",
      patch: { annualLifestyleSpending: spendLess },
    },
    {
      id: "spend-more",
      label: "Spend 10% more",
      description: "Raise annual lifestyle spending by 10%.",
      patch: { annualLifestyleSpending: spendMore },
    },
    {
      id: "save-less",
      label: `Save $${extra.toLocaleString("en-US")} less / year`,
      description: "Reduce annual savings until the target age.",
      patch: { annualContribution: saveLess },
    },
    {
      id: "save-more",
      label: `Save $${extra.toLocaleString("en-US")} more / year`,
      description: "Increase annual savings until the target age.",
      patch: { annualContribution: saveMore },
    },
  ];
}

export function applyScenario(
  plan: RetirementPlan,
  scenario: Pick<RetirementScenario, "patch">,
  currentYear?: number,
): RetirementPlan {
  return applyRetirementPlanPatch(plan, scenario.patch, currentYear);
}

export function compareRetirementScenarios(
  plan: RetirementPlan,
  options?: {
    currentYear?: number;
    paths?: number;
    seed?: number;
    includeBase?: boolean;
  },
): ScenarioComparison[] {
  const currentYear = options?.currentYear ?? new Date().getFullYear();
  const scenarios: RetirementScenario[] = [
    ...(options?.includeBase === false
      ? []
      : [
          {
            id: "base" as const,
            label: "Current plan",
            description: "Your saved assumptions.",
            patch: {},
          },
        ]),
    ...buildWhatIfScenarios(plan),
  ];

  return scenarios.map((scenario) => {
    const next = applyScenario(plan, scenario, currentYear);
    const projections = computeRetirementProjections(next, { currentYear });
    const monteCarlo = runRetirementMonteCarlo(next, {
      currentYear,
      paths: options?.paths ?? 400,
      seed: options?.seed ?? 7,
    });
    const depletionAge = findDepletionAge(projections);
    const lives = outlookLivesFromResult(monteCarlo, next.planEndAge);

    return {
      id: scenario.id,
      label: scenario.label,
      description: scenario.description,
      nestEggAtRetirement: nestEggAtRetirement(projections, next.retirementYear),
      successRate: next.assets.length === 0 ? null : monteCarlo.successRate,
      depletionAge,
      lastsPastPlanEnd: depletionAge === null && projections.length > 0,
      typicalAgeLabel: lives
        ? formatOutlookAge(lives.typical, next.planEndAge)
        : null,
      typicalLastsToTarget: lives?.typical.lastsToTarget ?? false,
      plan: next,
    };
  });
}
