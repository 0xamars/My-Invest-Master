import { applyRetirementPlanPatch } from "@/lib/retirement/normalize";
import {
  findDepletionAge,
  nestEggAtRetirement,
  computeRetirementProjections,
} from "@/lib/retirement/projections";
import { runRetirementMonteCarlo } from "@/lib/retirement/monte-carlo";
import type { RetirementPlan } from "@/types/retirement";

export type RetirementScenarioId =
  | "base"
  | "retire-later"
  | "spend-less"
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

  return [
    {
      id: "retire-later",
      label: "Retire 2 years later",
      description: `Work until ${plan.retirementAge + 2} instead of ${plan.retirementAge}.`,
      patch: { retirementAge: plan.retirementAge + 2 },
    },
    {
      id: "spend-less",
      label: "Spend 10% less",
      description: "Cut annual lifestyle spending by 10%.",
      patch: {
        annualLifestyleSpending: Math.round(plan.annualLifestyleSpending * 0.9),
      },
    },
    {
      id: "save-more",
      label: `Save $${extra.toLocaleString("en-US")} more / year`,
      description: "Increase annual savings until retirement.",
      patch: {
        annualContribution: plan.annualContribution + extra,
      },
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

    return {
      id: scenario.id,
      label: scenario.label,
      description: scenario.description,
      nestEggAtRetirement: nestEggAtRetirement(projections, next.retirementYear),
      successRate: next.assets.length === 0 ? null : monteCarlo.successRate,
      depletionAge,
      lastsPastPlanEnd: depletionAge === null && projections.length > 0,
      plan: next,
    };
  });
}
