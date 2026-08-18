"use client";

import { RetirePanel, RetireVerdictChip } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import type { ScenarioComparison } from "@/lib/retirement/scenarios";
import { formatProjectionMoney } from "@/lib/retirement/format";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { RetirementPlan } from "@/types/retirement";

export function RetirementWhatIf({
  comparisons,
  currency,
  rates,
  onApply,
}: {
  comparisons: ScenarioComparison[];
  currency: DisplayCurrency;
  rates: FxRates;
  onApply: (plan: RetirementPlan) => void;
}) {
  const alts = comparisons.filter((item) => item.id !== "base");

  return (
    <RetirePanel className="px-5 py-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight">What-if compare</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Same plan, one lever changed. Apply a row to make it the new base —
          the document is not duplicated.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {alts.map((item) => (
          <div
            key={item.id}
            className="flex flex-col rounded-xl border border-border/60 px-4 py-4"
          >
            <p className="text-sm font-semibold tracking-tight">{item.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row
                label="Nest egg at retirement"
                value={
                  item.nestEggAtRetirement == null
                    ? "—"
                    : formatProjectionMoney(item.nestEggAtRetirement, currency, rates)
                }
              />
              <Row
                label="Success"
                value={
                  item.successRate == null
                    ? "—"
                    : `${Math.round(item.successRate * 100)}%`
                }
              />
              <Row
                label="Money lasts"
                value={
                  item.lastsPastPlanEnd || item.depletionAge == null
                    ? `Past age ${item.plan.planEndAge}`
                    : `Age ${item.depletionAge}`
                }
              />
            </dl>
            <div className="mt-3 flex items-center justify-between gap-2">
              <RetireVerdictChip
                verdict={
                  item.nestEggAtRetirement == null
                    ? "empty"
                    : item.lastsPastPlanEnd
                      ? "on-track"
                      : "behind"
                }
              />
              <Button size="sm" variant="outline" onClick={() => onApply(item.plan)}>
                Apply as base
              </Button>
            </div>
          </div>
        ))}
      </div>
    </RetirePanel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-xs font-medium tabular-nums">{value}</dd>
    </div>
  );
}
