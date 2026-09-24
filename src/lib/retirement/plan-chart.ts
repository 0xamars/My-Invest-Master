import { buildProjectionChartData } from "@/lib/retirement/chart-data";
import { computeRetirementProjections } from "@/lib/retirement/projections";
import type {
  RetirementPlan,
  RetirementPlanAsset,
  YearProjection,
} from "@/types/retirement";

/**
 * Plan page chart, totals, and target-date figures follow the saved plan.
 * `bindFreedomPathPlan` replaces assets with the Invest book and Budget
 * leftover for the Retire home path. It must not feed this chart: asset
 * edits would persist and still leave the picture unchanged.
 */
export function projectionsForSavedPlan(
  plan: RetirementPlan,
  options?: { currentYear?: number },
): YearProjection[] {
  return computeRetirementProjections(plan, options);
}

/** Changes when an asset value, quantity, growth rate, or balance changes. */
export function projectionChartRevision(
  projections: YearProjection[],
  assets: RetirementPlanAsset[],
): string {
  const first = projections[0];
  const last = projections[projections.length - 1];
  const assetSig = assets
    .map((asset) =>
      [asset.id, asset.unitPrice, asset.quantity, asset.expectedCagr].join(":"),
    )
    .join("|");
  return [
    projections.length,
    first?.year ?? "",
    first?.closingBalance ?? "",
    last?.year ?? "",
    last?.closingBalance ?? "",
    assetSig,
  ].join("~");
}

export function savedPlanChartRows(
  plan: RetirementPlan,
  options?: { currentYear?: number },
) {
  const projections = projectionsForSavedPlan(plan, options);
  return buildProjectionChartData(projections, plan.assets);
}
