import { RetirePanel } from "@/components/retirement/retire-ui";
import {
  formatTickerField,
  TICKER_UNKNOWN,
} from "@/lib/ticker/format";
import {
  FUTURE_LOOK_LINE,
  TREASURY_PROXY_NOTE,
} from "@/lib/ticker/score";
import type { TickerSnapshot } from "@/lib/ticker/types";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="budget-metric-label">{label}</p>
      <p className="mt-1 text-sm tabular-nums">{value}</p>
    </div>
  );
}

function formatPrintDate(value: string | null): string {
  if (!value) return TICKER_UNKNOWN;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function TickerFutureSection({ snapshot }: { snapshot: TickerSnapshot }) {
  const future = snapshot.future;
  const missingEstimates = future.years.length === 0;
  const tooFewForward = future.forwardYears < 2;

  const street = snapshot.street;
  const hasTargets =
    street.targetConsensus != null ||
    street.targetHigh != null ||
    street.targetLow != null;
  const hasGrades =
    street.strongBuy != null ||
    street.buy != null ||
    street.hold != null ||
    street.sell != null ||
    street.strongSell != null ||
    street.consensus != null;

  return (
    <RetirePanel className="px-5 py-4" data-ticker-tab="future">
      <h2 className="text-sm font-semibold">Future</h2>
      <p className="mt-1 text-sm text-muted-foreground">{FUTURE_LOOK_LINE}</p>
      {missingEstimates ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Street annual estimates · {TICKER_UNKNOWN}
        </p>
      ) : tooFewForward ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Two forward years · {TICKER_UNKNOWN}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Fact
          label="Next print date"
          value={formatPrintDate(future.nextPrintDate)}
        />
        <Fact
          label="Street earnings growth (estimate)"
          value={formatTickerField({
            label: "Street earnings growth",
            value: future.earningsGrowth,
            kind: "percent",
          })}
        />
        <Fact
          label="Street revenue growth (estimate)"
          value={formatTickerField({
            label: "Street revenue growth",
            value: future.revenueGrowth,
            kind: "percent",
          })}
        />
        <Fact
          label="10-year Treasury (rate proxy)"
          value={formatTickerField({
            label: "Treasury",
            value: future.treasury10y,
            kind: "percent",
          })}
        />
      </div>

      {future.years.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="desk-table min-w-[32rem]">
            <thead>
              <tr>
                <th>Year</th>
                <th>Street revenue (estimate)</th>
                <th>Street EPS (estimate)</th>
                <th>Street net income (estimate)</th>
                <th>Street analysts (estimate)</th>
              </tr>
            </thead>
            <tbody>
              {future.years.map((year, index) => (
                <tr
                  key={year.fiscalYear ?? `estimate-${index}`}
                  className="border-t border-border/50"
                >
                  <td className="py-2 pr-3 tabular-nums">
                    {year.fiscalYear ?? TICKER_UNKNOWN}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatTickerField({
                      label: "",
                      value: year.revenue,
                      kind: "money",
                    })}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatTickerField({
                      label: "",
                      value: year.eps,
                      kind: "ratio",
                    })}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatTickerField({
                      label: "",
                      value: year.netIncome,
                      kind: "money",
                    })}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatTickerField({
                      label: "",
                      value: year.numberOfAnalysts,
                      kind: "count",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-6 border-t border-border/50 pt-5">
        <h3 className="text-sm font-semibold">Street outlook</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Analyst consensus and price targets from Financial Modeling Prep.
          Labeled street, not a house forecast. Missing stays {TICKER_UNKNOWN}.
        </p>
        {!hasTargets && !hasGrades ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Street consensus · {TICKER_UNKNOWN}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Fact
              label="Street price target (consensus)"
              value={formatTickerField({
                label: "Target",
                value: street.targetConsensus,
                kind: "ratio",
              })}
            />
            <Fact
              label="Street price target (median)"
              value={formatTickerField({
                label: "Median",
                value: street.targetMedian,
                kind: "ratio",
              })}
            />
            <Fact
              label="Street target high / low"
              value={
                street.targetHigh == null && street.targetLow == null
                  ? TICKER_UNKNOWN
                  : `${formatTickerField({
                      label: "High",
                      value: street.targetHigh,
                      kind: "ratio",
                    })} / ${formatTickerField({
                      label: "Low",
                      value: street.targetLow,
                      kind: "ratio",
                    })}`
              }
            />
            <Fact
              label="Street rating consensus"
              value={street.consensus ?? TICKER_UNKNOWN}
            />
            <Fact
              label="Street strong buy / buy"
              value={`${formatTickerField({
                label: "Strong buy",
                value: street.strongBuy,
                kind: "count",
              })} / ${formatTickerField({
                label: "Buy",
                value: street.buy,
                kind: "count",
              })}`}
            />
            <Fact
              label="Street hold / sell / strong sell"
              value={`${formatTickerField({
                label: "Hold",
                value: street.hold,
                kind: "count",
              })} / ${formatTickerField({
                label: "Sell",
                value: street.sell,
                kind: "count",
              })} / ${formatTickerField({
                label: "Strong sell",
                value: street.strongSell,
                kind: "count",
              })}`}
            />
          </div>
        )}
      </div>

      {snapshot.estimates.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {snapshot.estimates.map((item) => (
            <Fact
              key={item.label}
              label={item.label.startsWith("Street") || item.label.startsWith("Estimated")
                ? item.label.replace(/^Estimated /, "Street ")
                : `Street ${item.label}`}
              value={formatTickerField(item)}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">{TREASURY_PROXY_NOTE}</p>
    </RetirePanel>
  );
}
