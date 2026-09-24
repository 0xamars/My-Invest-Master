import { retirementPlanReady } from "@/lib/retirement/inputs";
import { computeRetirementProjections, nestEggAtRetirement } from "@/lib/retirement/projections";
import { computeTargetNestEgg, presentValue } from "@/lib/retirement/target";
import { getPlanTotalValue, type RetirementPlan } from "@/types/retirement";

const MIN_RATE = 0;
const MAX_RATE = 40;

function yearsToRetirement(plan: RetirementPlan): number | null {
  if (plan.currentAge == null || !Number.isFinite(plan.currentAge)) return null;
  return Math.max(0, plan.retirementAge - plan.currentAge);
}

/**
 * Constant annual growth (percent) the whole portfolio needs so the
 * nest egg at the target age, in today's dollars, meets spending ÷
 * withdrawal rate. Returns 0 when no growth is required, or null when
 * 40% a year still misses.
 */
export function requiredGrowthRate(
  plan: RetirementPlan,
  options?: { currentYear?: number },
): number | null {
  if (!retirementPlanReady(plan)) return null;
  const currentYear = options?.currentYear ?? new Date().getFullYear();
  const target = computeTargetNestEgg(
    plan.annualLifestyleSpending,
    plan.withdrawalRate,
  );
  if (target <= 0 || plan.assets.length === 0) return null;
  if (getPlanTotalValue(plan) <= 0 && plan.annualContribution <= 0) return null;

  const years = yearsToRetirement(plan);
  if (years == null) return null;

  const surplusAt = (rate: number): number => {
    const growthRates = Object.fromEntries(
      plan.assets.map((asset) => [asset.id, rate]),
    );
    const rows = computeRetirementProjections(plan, {
      currentYear,
      growthRates,
    });
    const nest = nestEggAtRetirement(rows, plan.retirementYear);
    if (nest == null) return -target;
    return presentValue(nest, plan.inflationRate, years) - target;
  };

  if (surplusAt(MIN_RATE) >= 0) return 0;
  if (surplusAt(MAX_RATE) < 0) return null;

  let lo = MIN_RATE;
  let hi = MAX_RATE;
  for (let step = 0; step < 48; step += 1) {
    const mid = (lo + hi) / 2;
    if (surplusAt(mid) >= 0) hi = mid;
    else lo = mid;
  }

  return Math.round(hi * 10) / 10;
}
