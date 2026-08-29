import type { RetirementDashboard } from "@/lib/retirement/dashboard";
import { buildWhatIfScenarios } from "@/lib/retirement/scenarios";
import type { RetirementPlan } from "@/types/retirement";

/**
 * Path sentence from leftover + book. One date, no invented CAGR.
 */
export function impliedPathSentence(
  dashboard: RetirementDashboard,
  formatMoney: (value: number) => string,
): string {
  if (dashboard.verdict === "empty") {
    return "Leftover or the book is missing. Freedom will not invent cash.";
  }

  const target = `Target ${formatMoney(dashboard.targetNestEgg)}.`;

  if (dashboard.yearsToFreedom === 0) {
    return `Free this year. ${target}`;
  }
  if (dashboard.freedomYear == null || dashboard.yearsToFreedom == null) {
    return `Not on this path by age ${dashboard.planEndAge}. ${target}`;
  }
  return `Free in ${dashboard.freedomYear} · age ${dashboard.freedomAge}. ${target}`;
}

/** Existing what-if labels only — not advice. */
export function whatIfLeverSentence(plan: RetirementPlan): string {
  const labels = buildWhatIfScenarios(plan).map((scenario) => scenario.label);
  if (labels.length === 0) return "";
  if (labels.length === 1) return `What-if on this plan: ${labels[0]}.`;
  const head = labels.slice(0, -1).join(", ");
  const last = labels[labels.length - 1];
  return `What-ifs on this plan: ${head}, or ${last}.`;
}
