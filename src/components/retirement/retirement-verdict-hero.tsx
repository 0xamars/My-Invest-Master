import type { ReactNode } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import {
  RetireEmptyState,
  RetireMoney,
  RetirePanel,
  RetireVerdictChip,
} from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import type { RetirementDashboard } from "@/lib/retirement/dashboard";
import { formatProjectionMoney } from "@/lib/retirement/format";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";

const VERDICT_COPY: Record<
  Exclude<RetirementDashboard["verdict"], "empty">,
  string
> = {
  ahead: "Projected nest egg is ahead of the spending target.",
  "on-track": "Projected nest egg is close to the spending target.",
  behind: "Projected nest egg is short of the spending target.",
};

export function RetirementVerdictHero({
  dashboard,
  currency,
  rates,
  planName,
  emptyActions,
  href,
}: {
  dashboard: RetirementDashboard;
  currency: DisplayCurrency;
  rates: FxRates;
  planName?: string;
  emptyActions?: ReactNode;
  href?: string;
}) {
  const money = (value: number) => formatProjectionMoney(value, currency, rates);

  if (dashboard.verdict === "empty") {
    return (
      <RetirePanel>
        <RetireEmptyState
          icon={<Wallet className="size-5" />}
          title="Add assets to see if you are on track"
          description="Import your Invest portfolio or add holdings. The target updates from spending and withdrawal rate even before assets are in."
          actions={emptyActions}
        />
        <div className="border-t border-border/60 px-5 py-4 text-sm text-muted-foreground">
          You need{" "}
          <span className="font-semibold text-foreground">
            {money(dashboard.targetNestEgg)}
          </span>{" "}
          to spend {money(dashboard.annualSpending)}/year at{" "}
          {dashboard.withdrawalRate}%.
        </div>
      </RetirePanel>
    );
  }

  const gap = dashboard.gapToday ?? 0;
  const gapTone = gap >= 0 ? "in" : "danger";
  const depletion =
    dashboard.lastsPastPlanEnd || dashboard.depletionAge == null
      ? `Lasts past age ${dashboard.planEndAge}`
      : `Runs out at age ${dashboard.depletionAge}`;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <section className="budget-hero px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <RetireVerdictChip verdict={dashboard.verdict} />
          {planName ? (
            <span className="text-xs text-muted-foreground">{planName}</span>
          ) : null}
        </div>
        <p
          className={cn(
            "budget-hero-value mt-3",
            dashboard.verdict === "behind"
              ? "text-[var(--brand-orange)]"
              : "text-[var(--brand-green)]",
          )}
        >
          {dashboard.verdict === "ahead"
            ? "Ahead"
            : dashboard.verdict === "behind"
              ? "Behind"
              : "On track"}
        </p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          You need ~{money(dashboard.targetNestEgg)} to spend{" "}
          {money(dashboard.annualSpending)}/year. {VERDICT_COPY[dashboard.verdict]}
        </p>
        <p className="mt-2 text-sm font-medium">{depletion}</p>
        {href ? (
          <Button
            className="mt-4"
            render={<Link href={href} />}
          >
            Open plan
          </Button>
        ) : null}
      </section>

      <RetirePanel className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-2">
        <Metric
          label="Current portfolio"
          value={money(dashboard.currentPortfolio)}
        />
        <Metric
          label="Target nest egg"
          value={money(dashboard.targetNestEgg)}
        />
        <Metric
          label="At retirement"
          value={
            dashboard.projectedNestEgg == null
              ? "—"
              : money(dashboard.projectedNestEgg)
          }
          hint={
            dashboard.projectedNestEggToday == null
              ? undefined
              : `${money(dashboard.projectedNestEggToday)} today`
          }
        />
        <Metric
          label={gap >= 0 ? "Surplus (today $)" : "Gap (today $)"}
          value={
            dashboard.gapToday == null ? "—" : money(Math.abs(gap))
          }
          hint={depletion}
          tone={gapTone}
        />
      </RetirePanel>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "in" | "out" | "danger" | "neutral";
}) {
  return (
    <div className="flex flex-col justify-center px-4 py-4 sm:px-5">
      <p className="budget-metric-label">{label}</p>
      <p className="budget-metric-value mt-1.5">
        <RetireMoney value={value} tone={tone} />
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
