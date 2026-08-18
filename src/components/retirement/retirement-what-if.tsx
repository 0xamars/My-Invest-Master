"use client";

import { RetireVerdictChip } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { formatProjectionMoney } from "@/lib/retirement/format";
import type { ScenarioComparison } from "@/lib/retirement/scenarios";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { RetirementPlan } from "@/types/retirement";
import { cn } from "@/lib/utils";

export function RetirementWhatIf({
  comparisons,
  selectedId,
  currency,
  rates,
  dirty,
  onSelect,
  onApply,
  onReset,
}: {
  comparisons: ScenarioComparison[];
  selectedId: string | null;
  currency: DisplayCurrency;
  rates: FxRates;
  dirty: boolean;
  onSelect: (plan: RetirementPlan, id: string) => void;
  onApply: (plan: RetirementPlan) => void;
  onReset: () => void;
}) {
  const alts = comparisons.filter((item) => item.id !== "base");
  const selected = alts.find((item) => item.id === selectedId);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Try a change</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Retire earlier or later, spend more or less, save more or less. The
          sentence and ages update right away. Apply when you want it as the
          plan.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {alts.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.plan, item.id)}
            className={cn(
              "flex flex-col rounded-xl border px-4 py-4 text-left transition-colors",
              selectedId === item.id
                ? "border-[var(--brand-green)]/50 bg-[var(--brand-green)]/6"
                : "border-border/60 hover:bg-muted/30",
            )}
          >
            <p className="text-sm font-semibold tracking-tight">{item.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row
                label="Typical market"
                value={
                  item.typicalAgeLabel == null
                    ? "—"
                    : item.typicalLastsToTarget
                      ? `Lasts to ${item.plan.planEndAge}`
                      : `Age ${item.typicalAgeLabel}`
                }
              />
              <Row
                label="Nest egg at retirement"
                value={
                  item.nestEggAtRetirement == null
                    ? "—"
                    : formatProjectionMoney(
                        item.nestEggAtRetirement,
                        currency,
                        rates,
                      )
                }
              />
            </dl>
            <div className="mt-3">
              <RetireVerdictChip
                verdict={
                  item.nestEggAtRetirement == null
                    ? "empty"
                    : item.typicalLastsToTarget || item.lastsPastPlanEnd
                      ? "on-track"
                      : "behind"
                }
              />
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!dirty || !selected}
          onClick={() => selected && onApply(selected.plan)}
        >
          Apply as base
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!dirty}
          onClick={onReset}
        >
          Reset
        </Button>
      </div>
    </div>
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
