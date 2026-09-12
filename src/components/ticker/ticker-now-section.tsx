import { TickerHealthSection } from "@/components/ticker/ticker-health-section";
import { RetirePanel } from "@/components/retirement/retire-ui";
import {
  formatTickerField,
  TICKER_UNKNOWN,
} from "@/lib/ticker/format";
import type { TickerField, TickerSnapshot } from "@/lib/ticker/types";

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="budget-metric-label">{label}</p>
      <p className="mt-1 text-sm">{value ?? TICKER_UNKNOWN}</p>
    </div>
  );
}

function FieldGrid({ title, fields }: { title: string; fields: TickerField[] }) {
  return (
    <RetirePanel className="px-5 py-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((item) => (
          <div key={item.label}>
            <p className="budget-metric-label">{item.label}</p>
            <p className="mt-1 text-base font-medium tabular-nums tracking-tight">
              {formatTickerField(item)}
            </p>
          </div>
        ))}
      </div>
    </RetirePanel>
  );
}

export function TickerNowSection({ snapshot }: { snapshot: TickerSnapshot }) {
  const { profile, quote } = snapshot;

  return (
    <div className="flex flex-col gap-5" data-ticker-tab="now">
      <RetirePanel className="px-5 py-4">
        <h2 className="text-sm font-semibold">Company</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Current profile and TTM figures from Financial Modeling Prep. Missing
          stays {TICKER_UNKNOWN}.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {profile.description ?? TICKER_UNKNOWN}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="CEO" value={profile.ceo} />
          <Fact label="Country" value={profile.country} />
          <Fact label="Sector" value={profile.sector} />
          <Fact label="Industry" value={profile.industry} />
          <Fact
            label="Employees"
            value={
              profile.employees != null
                ? profile.employees.toLocaleString("en-US")
                : null
            }
          />
          <Fact label="IPO" value={profile.ipoDate} />
          <Fact
            label="Volume"
            value={
              quote.volume == null
                ? null
                : formatTickerField({
                    label: "Volume",
                    value: quote.volume,
                    kind: "shares",
                  })
            }
          />
          <Fact
            label="Beta"
            value={
              quote.beta == null
                ? null
                : formatTickerField({
                    label: "Beta",
                    value: quote.beta,
                    kind: "ratio",
                  })
            }
          />
        </div>
      </RetirePanel>

      <FieldGrid title="Current multiples" fields={snapshot.keyMetrics} />
      <FieldGrid title="Profitability (TTM)" fields={snapshot.margins} />
      <FieldGrid title="Income (latest year)" fields={snapshot.income} />
      <FieldGrid title="Cash flow (latest year)" fields={snapshot.cashflow} />
      <FieldGrid title="Balance sheet (latest year)" fields={snapshot.balance} />
      <TickerHealthSection snapshot={snapshot} />
    </div>
  );
}
