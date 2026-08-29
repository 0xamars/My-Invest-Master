import { RetirePanel } from "@/components/retirement/retire-ui";
import { formatTickerField, TICKER_UNKNOWN } from "@/lib/ticker/format";
import { HEALTH_LOOK_LINE } from "@/lib/ticker/score";
import type { TickerSnapshot } from "@/lib/ticker/types";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="budget-metric-label">{label}</p>
      <p className="mt-1 text-sm tabular-nums">{value}</p>
    </div>
  );
}

function versus(left: number | null, right: number | null): string {
  if (left == null || right == null) return TICKER_UNKNOWN;
  return `${formatTickerField({ label: "", value: left, kind: "money" })} vs ${formatTickerField({ label: "", value: right, kind: "money" })}`;
}

export function TickerHealthSection({ snapshot }: { snapshot: TickerSnapshot }) {
  const health = snapshot.health;
  const emptyBalance = snapshot.health.currentAssets == null &&
    snapshot.health.totalDebt == null &&
    snapshot.health.cashAndSti == null;

  return (
    <RetirePanel className="px-5 py-4">
      <h2 className="text-sm font-semibold">Health</h2>
      <p className="mt-1 text-sm text-muted-foreground">{HEALTH_LOOK_LINE}</p>
      {emptyBalance ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Latest balance · {TICKER_UNKNOWN}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Fact
          label="Cash + STI vs total debt"
          value={versus(health.cashAndSti, health.totalDebt)}
        />
        <Fact
          label="Current assets vs current liabilities"
          value={versus(health.currentAssets, health.currentLiabilities)}
        />
        <Fact
          label="Current assets vs long-term liabilities"
          value={versus(health.currentAssets, health.longTermLiabilities)}
        />
        <Fact
          label="Debt / equity"
          value={formatTickerField({
            label: "D/E",
            value: health.debtToEquity,
            kind: "ratio",
          })}
        />
        <Fact
          label="OCF vs debt"
          value={versus(health.operatingCashFlow, health.totalDebt)}
        />
        <Fact
          label="Interest cover"
          value={formatTickerField({
            label: "Interest cover",
            value: health.interestCoverage,
            kind: "ratio",
          })}
        />
        <Fact
          label="Altman Z"
          value={
            health.altmanZ == null
              ? TICKER_UNKNOWN
              : formatTickerField({
                  label: "Altman Z",
                  value: health.altmanZ,
                  kind: "ratio",
                })
          }
        />
        <Fact
          label="Piotroski"
          value={
            health.piotroski == null
              ? TICKER_UNKNOWN
              : formatTickerField({
                  label: "Piotroski",
                  value: health.piotroski,
                  kind: "count",
                })
          }
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Altman Z and Piotroski are extras. They are not a Score petal.
      </p>
    </RetirePanel>
  );
}
