"use client";

import { Button } from "@/components/ui/button";
import { formatProjectionMoney } from "@/lib/retirement/format";
import {
  nudgeAnnualSavings,
  nudgeAnnualSpending,
  nudgeRetirementAge,
} from "@/lib/retirement/outlook";
import { defaultExtraAnnualSavings } from "@/lib/retirement/scenarios";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import type { RetirementPlan } from "@/types/retirement";

export function RetirementWhatIf({
  plan,
  preview,
  currency,
  rates,
  onPreview,
  onApply,
  onReset,
  dirty,
}: {
  plan: RetirementPlan;
  preview: RetirementPlan;
  currency: DisplayCurrency;
  rates: FxRates;
  onPreview: (next: RetirementPlan) => void;
  onApply: (next: RetirementPlan) => void;
  onReset: () => void;
  dirty: boolean;
}) {
  const saveStep = defaultExtraAnnualSavings(plan.annualContribution);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Try a change</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Retire earlier or later, spend more or less, save more or less. The
          ages and path update right away. Apply when you want it as the plan.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Lever
          label="Retire"
          value={`Age ${preview.retirementAge}`}
          lessLabel="Earlier"
          moreLabel="Later"
          onLess={() => onPreview(nudgeRetirementAge(preview, -1))}
          onMore={() => onPreview(nudgeRetirementAge(preview, 1))}
          lessDisabled={preview.retirementAge <= preview.currentAge}
          moreDisabled={preview.retirementAge >= preview.planEndAge}
        />
        <Lever
          label="Spend / year"
          value={`${formatProjectionMoney(preview.annualLifestyleSpending, currency, rates)}/yr`}
          lessLabel="Less"
          moreLabel="More"
          onLess={() => onPreview(nudgeAnnualSpending(preview, -1))}
          onMore={() => onPreview(nudgeAnnualSpending(preview, 1))}
          lessDisabled={preview.annualLifestyleSpending <= 0}
        />
        <Lever
          label="Save / year"
          value={`${formatProjectionMoney(preview.annualContribution, currency, rates)}/yr`}
          lessLabel="Less"
          moreLabel="More"
          onLess={() =>
            onPreview(nudgeAnnualSavings(preview, -1, undefined, saveStep))
          }
          onMore={() =>
            onPreview(nudgeAnnualSavings(preview, 1, undefined, saveStep))
          }
          lessDisabled={preview.annualContribution <= 0}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!dirty}
          onClick={() => onApply(preview)}
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

function Lever({
  label,
  value,
  lessLabel,
  moreLabel,
  onLess,
  onMore,
  lessDisabled,
  moreDisabled,
}: {
  label: string;
  value: string;
  lessLabel: string;
  moreLabel: string;
  onLess: () => void;
  onMore: () => void;
  lessDisabled?: boolean;
  moreDisabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 px-3 py-3">
      <p className="budget-metric-label">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <div className="mt-2 flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={lessDisabled}
          onClick={onLess}
        >
          {lessLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={moreDisabled}
          onClick={onMore}
        >
          {moreLabel}
        </Button>
      </div>
    </div>
  );
}
