import { TickerStatementCharts } from "@/components/ticker/ticker-statement-charts";
import { RetirePanel } from "@/components/retirement/retire-ui";
import {
  formatTickerField,
  TICKER_UNKNOWN,
} from "@/lib/ticker/format";
import { PAST_LOOK_LINE } from "@/lib/ticker/score";
import type { TickerSnapshot } from "@/lib/ticker/types";

function Fact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="budget-metric-label">{label}</p>
      <p className="mt-1 text-sm tabular-nums">{value}</p>
    </div>
  );
}

export function TickerPastSection({ snapshot }: { snapshot: TickerSnapshot }) {
  const past = snapshot.past;
  const tooFewYears = past.years.length < 2;

  return (
    <RetirePanel className="px-5 py-4">
      <h2 className="text-sm font-semibold">Past</h2>
      <p className="mt-1 text-sm text-muted-foreground">{PAST_LOOK_LINE}</p>

      <div className="mt-4 space-y-6">
        <TickerStatementCharts title="Annual" points={snapshot.charts.annual} />
        <TickerStatementCharts title="Quarterly" points={snapshot.charts.quarterly} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Fact
          label="Revenue streak"
          value={tooFewYears ? TICKER_UNKNOWN : past.revenueStreak}
        />
        <Fact
          label="Net-income streak"
          value={tooFewYears ? TICKER_UNKNOWN : past.netIncomeStreak}
        />
        <Fact
          label="Diluted EPS"
          value={formatTickerField({
            label: "Diluted EPS",
            value: past.epsDiluted,
            kind: "ratio",
          })}
        />
        <Fact
          label="ROE"
          value={
            past.roe == null
              ? TICKER_UNKNOWN
              : formatTickerField({ label: "ROE", value: past.roe, kind: "percent" })
          }
        />
        <Fact
          label="ROCE"
          value={
            past.roce == null
              ? TICKER_UNKNOWN
              : formatTickerField({ label: "ROCE", value: past.roce, kind: "percent" })
          }
        />
        <Fact
          label="ROA"
          value={
            past.roa == null
              ? TICKER_UNKNOWN
              : formatTickerField({ label: "ROA", value: past.roa, kind: "percent" })
          }
        />
        <Fact
          label="Share-count change"
          value={formatTickerField({
            label: "Share-count change",
            value: past.shareCountChange,
            kind: "percent",
          })}
        />
        <Fact
          label="Stock-based compensation"
          value={formatTickerField({
            label: "SBC",
            value: past.stockBasedCompensation,
            kind: "money",
          })}
        />
        <Fact
          label="SBC vs net income"
          value={formatTickerField({
            label: "SBC vs NI",
            value: past.sbcVsNetIncome,
            kind: "percent",
          })}
        />
      </div>

      {past.years.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Year</th>
                <th className="py-2 pr-3 font-medium">Revenue</th>
                <th className="py-2 pr-3 font-medium">Net income</th>
                <th className="py-2 pr-3 font-medium">Diluted EPS</th>
                <th className="py-2 pr-3 font-medium">Diluted shares</th>
              </tr>
            </thead>
            <tbody>
              {past.years.map((year) => (
                <tr
                  key={year.fiscalYear ?? "unknown"}
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
                      value: year.netIncome,
                      kind: "money",
                    })}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatTickerField({
                      label: "",
                      value: year.epsDiluted,
                      kind: "ratio",
                    })}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatTickerField({
                      label: "",
                      value: year.sharesDiluted,
                      kind: "shares",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Annual income rows · {TICKER_UNKNOWN}
        </p>
      )}
    </RetirePanel>
  );
}
