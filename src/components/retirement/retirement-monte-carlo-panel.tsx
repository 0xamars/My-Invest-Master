"use client";

import { useEffect, useMemo, useState } from "react";
import { RetirementOutlookChart } from "@/components/retirement/retirement-outlook-chart";
import { RetirementWhatIf } from "@/components/retirement/retirement-what-if";
import { RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_MONTE_CARLO_PATHS,
  runRetirementMonteCarlo,
  type MonteCarloResult,
} from "@/lib/retirement/monte-carlo";
import {
  formatOutlookAge,
  outlookChartRows,
  outlookLeversDirty,
  outlookLivesFromResult,
  outlookSentence,
} from "@/lib/retirement/outlook";
import {
  compareRetirementScenarios,
  type RetirementScenarioId,
} from "@/lib/retirement/scenarios";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import {
  DEFAULT_VOLATILITY_BY_TYPE,
  type RetirementPlan,
} from "@/types/retirement";

const OUTLOOK_SEED = 17;

export function RetirementMonteCarloPanel({
  plan,
  result,
  currency,
  rates,
  onApply,
}: {
  plan: RetirementPlan;
  result: MonteCarloResult | null;
  currency: DisplayCurrency;
  rates: FxRates;
  onApply: (next: RetirementPlan) => void;
}) {
  const [preview, setPreview] = useState<RetirementPlan | null>(null);
  const [selectedId, setSelectedId] = useState<RetirementScenarioId | null>(
    null,
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setPreview(null);
    setSelectedId(null);
  }, [
    plan.id,
    plan.retirementAge,
    plan.annualLifestyleSpending,
    plan.annualContribution,
    plan.assets,
    plan.incomeStreams,
    plan.inflationRate,
    plan.planEndAge,
    plan.currentAge,
  ]);

  const displayed = preview ?? plan;
  const dirty = preview != null && outlookLeversDirty(plan, preview);

  const whatIf = useMemo(
    () =>
      plan.assets.length > 0
        ? compareRetirementScenarios(plan, {
            includeBase: false,
            paths: 400,
            seed: 17,
          })
        : [],
    [plan],
  );

  const displayedResult = useMemo(() => {
    if (!preview) return result;
    if (preview.assets.length === 0) return null;
    return runRetirementMonteCarlo(preview, {
      paths: result?.paths ?? DEFAULT_MONTE_CARLO_PATHS,
      seed: OUTLOOK_SEED,
    });
  }, [preview, result]);

  const lives = outlookLivesFromResult(displayedResult, displayed.planEndAge);
  const sentence = outlookSentence(lives, displayed.planEndAge);
  const chartRows = useMemo(
    () => outlookChartRows(displayedResult?.percentiles ?? []),
    [displayedResult],
  );

  return (
    <RetirePanel className="px-5 py-5 sm:px-6 sm:py-6">
      <p className="max-w-2xl text-base font-medium leading-relaxed tracking-tight sm:text-lg">
        {sentence}
      </p>

      {lives ? (
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {([lives.bad, lives.typical, lives.good] as const).map((life) => (
            <div
              key={life.key}
              className={cn(
                "rounded-xl px-3 py-3 sm:px-4",
                life.key === "bad" && "bg-[var(--brand-orange)]/10",
                life.key === "typical" && "bg-[var(--brand-green)]/8",
                life.key === "good" && "bg-[var(--brand-green-deep)]/8",
              )}
            >
              <p className="budget-metric-label">{life.label}</p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.65rem]">
                {formatOutlookAge(life, displayed.planEndAge)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {life.marketLabel}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {chartRows.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs text-muted-foreground">
            Portfolio by age if markets are bad, typical, or good.
          </p>
          <RetirementOutlookChart
            rows={chartRows}
            currency={currency}
            rates={rates}
          />
        </div>
      ) : null}

      {plan.assets.length > 0 ? (
        <div className="mt-5 border-t border-border/60 pt-5">
          <RetirementWhatIf
            comparisons={whatIf}
            selectedId={selectedId}
            currency={currency}
            rates={rates}
            dirty={dirty}
            onSelect={(next, id) => {
              setSelectedId(id as RetirementScenarioId);
              setPreview(next);
            }}
            onApply={(next) => {
              onApply(next);
              setPreview(null);
              setSelectedId(null);
            }}
            onReset={() => {
              setPreview(null);
              setSelectedId(null);
            }}
          />
        </div>
      ) : null}

      <div className="mt-5 border-t border-border/60 pt-4">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="-ml-2 text-muted-foreground"
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
        >
          How this is estimated
        </Button>

        {advancedOpen ? (
          <AdvancedEstimate
            plan={displayed}
            result={displayedResult}
          />
        ) : null}
      </div>
    </RetirePanel>
  );
}

function AdvancedEstimate({
  plan,
  result,
}: {
  plan: RetirementPlan;
  result: MonteCarloResult | null;
}) {
  const lives = outlookLivesFromResult(result, plan.planEndAge);
  const percent =
    result && result.percentiles.length > 0
      ? Math.round(result.successRate * 100)
      : null;

  return (
    <div className="mt-3 max-w-2xl space-y-3 text-xs leading-relaxed text-muted-foreground">
      <p>
        This is a Monte Carlo estimate
        {result ? ` using ${result.paths} lives` : ""}. Each life draws a
        yearly return around the expected return you set on each holding.
      </p>
      <p>
        Assumed year-to-year swing: stocks {DEFAULT_VOLATILITY_BY_TYPE.stock}%,
        crypto {DEFAULT_VOLATILITY_BY_TYPE.crypto}%, cash{" "}
        {DEFAULT_VOLATILITY_BY_TYPE.cash}%, other{" "}
        {DEFAULT_VOLATILITY_BY_TYPE.custom}%. Inflation is {plan.inflationRate}
        %.
      </p>
      {lives ? (
        <p>
          Raw percentiles — portfolio runs out at p10{" "}
          {formatOutlookAge(lives.bad, plan.planEndAge).toLowerCase()}, p50{" "}
          {formatOutlookAge(lives.typical, plan.planEndAge).toLowerCase()}, p90{" "}
          {formatOutlookAge(lives.good, plan.planEndAge).toLowerCase()}.
        </p>
      ) : (
        <p>Add holdings to run the paths.</p>
      )}
      {percent != null ? (
        <p>
          {percent}% of lives still have money at age {plan.planEndAge}.
        </p>
      ) : null}
    </div>
  );
}
