"use client";

import { RetirePanel } from "@/components/retirement/retire-ui";
import type { MonteCarloResult } from "@/lib/retirement/monte-carlo";
import { DEFAULT_VOLATILITY_BY_TYPE } from "@/types/retirement";

export function RetirementMonteCarloPanel({
  result,
}: {
  result: MonteCarloResult | null;
}) {
  const percent =
    result && result.percentiles.length > 0
      ? Math.round(result.successRate * 100)
      : null;

  return (
    <RetirePanel className="px-5 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Monte Carlo</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Light illustration only — not a 1871 historical backtest. Each path
            draws asset return = expected CAGR ± default volatility. Success
            means the portfolio is still above $0 at plan end age.
          </p>
        </div>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {percent == null ? "—" : `${percent}%`}
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            success
          </span>
        </p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Vol assumptions: stocks {DEFAULT_VOLATILITY_BY_TYPE.stock}%, crypto{" "}
        {DEFAULT_VOLATILITY_BY_TYPE.crypto}%, cash {DEFAULT_VOLATILITY_BY_TYPE.cash}
        %, custom {DEFAULT_VOLATILITY_BY_TYPE.custom}%.{" "}
        {result ? `${result.paths} paths.` : "Add assets to run paths."} The
        expected line stays the deterministic CAGR path; the chart band is
        p10–p90.
      </p>
    </RetirePanel>
  );
}
