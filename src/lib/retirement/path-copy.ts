import type { RetirementDashboard } from "@/lib/retirement/dashboard";
import { buildWhatIfScenarios } from "@/lib/retirement/scenarios";
import type { RetirementPlan } from "@/types/retirement";

/**
 * Path sentence from numbers already on the Retire dashboard.
 * Does not invent a CAGR or a spreadsheet target.
 */
export function impliedPathSentence(
  dashboard: RetirementDashboard,
  formatMoney: (value: number) => string,
): string {
  if (dashboard.verdict === "empty") {
    return "Refresh from the book or add assets to see whether you are on track.";
  }

  const years = dashboard.yearsToRetirement;
  const yearsBit =
    years <= 0
      ? "Retirement age is this year"
      : years === 1
        ? "1 year left"
        : `${years} years left`;

  if (dashboard.gapToday == null || dashboard.targetNestEgg <= 0) {
    return `${yearsBit}. Target ${formatMoney(dashboard.targetNestEgg)}.`;
  }

  const gapAbs = formatMoney(Math.abs(dashboard.gapToday));
  if (dashboard.gapToday >= 0) {
    return `${yearsBit}. ${gapAbs} surplus today versus the spending target.`;
  }
  return `${yearsBit}. ${gapAbs} short today versus the spending target.`;
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
