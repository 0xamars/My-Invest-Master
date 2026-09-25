import { formatProjectionMoney } from "@/lib/retirement/format";
import {
  EXAMPLE_COUPLE,
  EXAMPLE_COUPLE_COMPARISON,
  EXAMPLE_COUPLE_YEAR,
  EXAMPLE_PREVIEW_YEARS,
  EXAMPLE_RATES,
  formatExampleCad,
} from "@/lib/retirement/example-couple";
import {
  sharedTaxComparison,
  type SharedOrderTax,
  type WithdrawalOrderComparison,
} from "@/lib/retirement/withdrawal-orders";
import { cn } from "@/lib/utils";

const MONEY = "px-3 py-2 text-right text-sm tabular-nums whitespace-nowrap";
const STICKY =
  "sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm whitespace-nowrap";

function money(value: number): string {
  return formatProjectionMoney(value, "CAD", EXAMPLE_RATES);
}

function AccountLine({
  name,
  age,
  accounts,
  income,
}: {
  name: string;
  age: number;
  accounts: { rrsp: number; tfsa: number; nonRegistered: number };
  income: { cpp: number; oas: number };
}) {
  return (
    <div>
      <p className="text-sm font-semibold">
        {name}, {age}
      </p>
      <p className="type-small mt-1 text-[var(--fg-muted)]">
        RRSP {formatExampleCad(accounts.rrsp)} · TFSA {formatExampleCad(accounts.tfsa)} ·
        Non-registered {formatExampleCad(accounts.nonRegistered)}
      </p>
      <p className="type-small text-[var(--fg-muted)]">
        CPP {formatExampleCad(income.cpp)} · OAS {formatExampleCad(income.oas)}
      </p>
    </div>
  );
}

export function ExampleWithdrawalComparison() {
  const comparison = EXAMPLE_COUPLE_COMPARISON;
  if (comparison.status !== "ready" || comparison.orders.length === 0) {
    return (
      <figure className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-8" data-example-plan>
        <figcaption className="type-eyebrow text-[var(--fg-eyebrow)]">
          Example plan, fictional numbers
        </figcaption>
        <p className="type-small mt-3 text-[var(--fg-muted)]">
          Sam & Riley. This illustration needs an age and a spending amount before the
          comparison can run.
        </p>
      </figure>
    );
  }

  const shared = sharedTaxComparison(comparison.orders);
  const sharedTaxes = comparison.orders.map(
    (order) => shared.taxes[order.id]?.totalTax ?? order.totals.totalTax,
  );
  const lowestTax = Math.min(...sharedTaxes);
  const highestEstate = Math.max(
    ...comparison.orders.map((order) => order.totals.endingAfterTaxEstate),
  );
  const tableOrder =
    comparison.orders.find(
      (order) => (shared.taxes[order.id]?.totalTax ?? order.totals.totalTax) <= lowestTax + 0.01,
    ) ?? comparison.orders[0];
  const preview = tableOrder.householdRows.slice(0, EXAMPLE_PREVIEW_YEARS);
  const taxLabel = shared.throughYear == null ? "Lifetime tax" : `Tax through ${shared.throughYear}`;
  const taxBadge =
    shared.throughYear == null ? "Lowest lifetime tax" : `Lowest tax through ${shared.throughYear}`;

  return (
    <figure
      className="mx-auto w-full max-w-5xl px-6 py-4 sm:px-8 sm:py-8"
      data-example-plan
    >
      <figcaption className="type-eyebrow text-[var(--fg-eyebrow)]">
        Example plan, fictional numbers
      </figcaption>
      <h2 className="type-h2 mt-3">Sam & Riley</h2>
      <p className="type-small mt-2 max-w-3xl text-[var(--fg-muted)]">
        Made-up ages, balances, and spending for two people in Ontario. Amounts in CAD.
        Not a real household.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <AccountLine
          name={EXAMPLE_COUPLE.names.person1}
          age={EXAMPLE_COUPLE.ages.person1}
          accounts={EXAMPLE_COUPLE.accounts.person1}
          income={EXAMPLE_COUPLE.income.person1}
        />
        <AccountLine
          name={EXAMPLE_COUPLE.names.person2}
          age={EXAMPLE_COUPLE.ages.person2}
          accounts={EXAMPLE_COUPLE.accounts.person2}
          income={EXAMPLE_COUPLE.income.person2}
        />
      </div>

      <ul className="type-small mt-6 max-w-3xl space-y-1.5 text-[var(--fg-muted)]">
        <li>
          Spending {formatExampleCad(EXAMPLE_COUPLE.spendingCad)} a year, starting in{" "}
          {EXAMPLE_COUPLE_YEAR}. Inflation {EXAMPLE_COUPLE.inflationPercent}%. Each
          account grows at {EXAMPLE_COUPLE.growthPercent}%.
        </li>
        <li>
          CPP and OAS above are made-up amounts that start at 65 and rise with
          inflation. Pension split {EXAMPLE_COUPLE.pensionSplitPercent}%.
        </li>
        <li>
          Unrealized gain share {EXAMPLE_COUPLE.gainShare * 100}%. Capital gains
          inclusion {EXAMPLE_COUPLE.inclusionRate * 100}%. An RRSP converts to a RRIF
          at 71.
        </li>
        <li>
          Federal and Ontario brackets for {EXAMPLE_COUPLE_YEAR}, indexed at the
          inflation rate. Meltdown target income and TFSA room use those published
          defaults. The example runs to age {EXAMPLE_COUPLE.endAge}.
        </li>
      </ul>

      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {comparison.orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            tax={shared.taxes[order.id]}
            taxLabel={taxLabel}
            taxBadge={taxBadge}
            lowTax={(shared.taxes[order.id]?.totalTax ?? order.totals.totalTax) <= lowestTax + 0.01}
            highEstate={order.totals.endingAfterTaxEstate === highestEstate}
            shown={order.id === tableOrder.id}
          />
        ))}
      </div>
      <p className="type-small mt-3 text-[var(--fg-muted)]">
        {shared.throughYear == null
          ? "Marks show the lowest lifetime tax and the highest ending estate. Neither mark is a recommendation."
          : `Tax is compared through ${shared.throughYear}, the last year every order still covered spending. An order is not marked lowest tax because it ran out sooner or lasted longer. The highest ending estate is the balance at the end of the plan. Neither mark is a recommendation.`}
      </p>

      <div className="surface-card mt-6 overflow-hidden">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h3 className="text-base font-semibold">Year by year</h3>
          <p className="type-small mt-1 text-[var(--fg-muted)]">
            {tableOrder.label}. First {preview.length} years. The example continues to
            age {EXAMPLE_COUPLE.endAge}.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              First {preview.length} years of the {tableOrder.label} order for Sam and
              Riley, with federal tax, Ontario tax, and OAS clawback.
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-[var(--fg-muted)]">
                <th className={STICKY} scope="col">
                  Year
                </th>
                <th className={MONEY} scope="col">
                  RRSP / RRIF
                </th>
                <th className={MONEY} scope="col">
                  TFSA
                </th>
                <th className={MONEY} scope="col">
                  Non-registered
                </th>
                <th className={MONEY} scope="col">
                  Federal tax
                </th>
                <th className={MONEY} scope="col">
                  Ontario tax
                </th>
                <th className={MONEY} scope="col">
                  OAS clawback
                </th>
                <th className={MONEY} scope="col">
                  Total tax
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => {
                const sam = tableOrder.rowsByPerson.person1.find(
                  (person) => person.year === row.year,
                );
                const riley = tableOrder.rowsByPerson.person2.find(
                  (person) => person.year === row.year,
                );
                return (
                  <tr key={row.year} className="border-b border-border last:border-0">
                    <th className={cn(STICKY, "font-medium")} scope="row">
                      <span className="block">{row.year}</span>
                      <span className="type-small block font-normal text-[var(--fg-muted)]">
                        Sam {sam?.age ?? "—"} · Riley {riley?.age ?? "—"}
                      </span>
                    </th>
                    <td className={MONEY}>{money(row.withdrawals.rrspRrif)}</td>
                    <td className={MONEY}>{money(row.withdrawals.tfsa)}</td>
                    <td className={MONEY}>{money(row.withdrawals.nonRegisteredCash)}</td>
                    <td className={MONEY}>{money(row.federalTax)}</td>
                    <td className={MONEY}>{money(row.provincialTax)}</td>
                    <td className={MONEY}>{money(row.oasClawback)}</td>
                    <td className={MONEY}>{money(row.totalTax)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="type-small mt-4 text-[var(--fg-muted)]">Educational, not advice.</p>
    </figure>
  );
}

function OrderCard({
  order,
  tax,
  taxLabel,
  taxBadge,
  lowTax,
  highEstate,
  shown,
}: {
  order: WithdrawalOrderComparison;
  tax: SharedOrderTax | undefined;
  taxLabel: string;
  taxBadge: string;
  lowTax: boolean;
  highEstate: boolean;
  shown: boolean;
}) {
  const shownTax = tax ?? {
    federalTax: order.totals.federalTax,
    provincialTax: order.totals.provincialTax,
    oasClawback: order.totals.oasClawback,
    totalTax: order.totals.totalTax,
  };
  return (
    <div
      className={cn(
        "surface-card flex flex-col gap-3 px-4 py-4",
        shown && "border-primary",
      )}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{order.label}</h3>
          {lowTax ? (
            <span className="rounded-4xl bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {taxBadge}
            </span>
          ) : null}
          {highEstate ? (
            <span className="rounded-4xl border border-border px-2 py-0.5 text-xs font-medium">
              Highest ending estate
            </span>
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-[var(--fg-muted)]">{order.summary}</p>
      </div>
      <dl className="mt-auto space-y-2 text-sm">
        <Stat label={taxLabel} value={money(shownTax.totalTax)} />
        <Stat label="Federal" value={money(shownTax.federalTax)} />
        <Stat label="Ontario" value={money(shownTax.provincialTax)} />
        <Stat label="OAS clawback" value={money(shownTax.oasClawback)} />
        <Stat
          label="Ending estate, after tax"
          value={money(order.totals.endingAfterTaxEstate)}
        />
        <Stat
          label="Depletion year"
          value={
            order.totals.depletionYear == null
              ? "Not depleted"
              : String(order.totals.depletionYear)
          }
        />
      </dl>
      {order.totals.depletionYear != null ? (
        <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
          Depleted in {order.totals.depletionYear}. This order does not cover spending
          through the end of the plan.
        </p>
      ) : null}
      {shown ? (
        <p className="type-small text-[var(--brand-green-text)]">Shown year by year</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--fg-muted)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
