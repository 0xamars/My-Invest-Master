"use client";

import { useMemo, useState } from "react";
import { RetirementDisclaimer } from "@/components/retirement/retirement-disclaimer";
import { RetireEmptyState, RetireField } from "@/components/retirement/retire-ui";
import { CurrencyAmountInput } from "@/components/retirement/currency-amount-input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatProjectionMoney } from "@/lib/retirement/format";
import {
  CA_TAX_LIMITATIONS,
  CA_TAX_SOURCES,
} from "@/lib/retirement/tax-ca";
import {
  compareWithdrawalOrders,
  resolveWithdrawalAssumptions,
  WITHDRAWAL_ORDER_DETAILS,
  WITHDRAWAL_OWNER_RULE,
  type PersonWithdrawalYearRow,
  type WithdrawalOrderComparison,
} from "@/lib/retirement/withdrawal-orders";
import { getFxRate } from "@/lib/portfolio/prices/fx";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import {
  personLabel,
  type RetirementPersonId,
  type RetirementPlan,
  type RetirementWithdrawalAssumptions,
  type WithdrawalOrderId,
} from "@/types/retirement";

type Viewer = RetirementPersonId | "household";

const MONEY = "min-w-[7.5rem] px-3 py-2 text-right text-sm tabular-nums";
const STICKY = "sticky left-0 z-10 min-w-[7rem] bg-card px-3 py-2 text-left text-sm";

function money(
  value: number,
  currency: DisplayCurrency,
  rates: FxRates,
): string {
  return formatProjectionMoney(value, currency, rates);
}

function patchAssumptions(
  plan: RetirementPlan,
  patch: Partial<RetirementWithdrawalAssumptions>,
): RetirementPlan {
  return {
    ...plan,
    withdrawalAssumptions: { ...plan.withdrawalAssumptions, ...patch },
  };
}

export function RetirementWithdrawalOrder({
  plan,
  currency,
  rates,
  currentYear,
  onChange,
}: {
  plan: RetirementPlan;
  currency: DisplayCurrency;
  rates: FxRates;
  currentYear: number;
  onChange: (plan: RetirementPlan) => void;
}) {
  const missingAccounts = plan.assets.length === 0;
  const missingSpending = !(plan.annualLifestyleSpending > 0);
  const missingAge =
    !(plan.currentAge > 0) ||
    (plan.spouse != null && !(plan.spouse.currentAge > 0));
  const blocked = missingAccounts || missingSpending || missingAge;
  const cadPerUsd = getFxRate("CAD", rates);

  const resolved = useMemo(
    () => resolveWithdrawalAssumptions(plan, cadPerUsd, currentYear),
    [plan, cadPerUsd, currentYear],
  );
  const comparison = useMemo(
    () =>
      blocked
        ? null
        : compareWithdrawalOrders(plan, { currentYear, cadPerUsd }),
    [blocked, plan, currentYear, cadPerUsd],
  );

  const [viewer, setViewer] = useState<Viewer>("household");
  const selected =
    comparison?.assumptions.selectedOrder ??
    plan.withdrawalAssumptions.selectedOrder;
  const selectedOrder =
    comparison?.orders.find((order) => order.id === selected) ??
    comparison?.orders[0] ??
    null;

  const lowestTax = comparison
    ? Math.min(...comparison.orders.map((order) => order.totals.totalTax))
    : 0;
  const highestEstate = comparison
    ? Math.max(
        ...comparison.orders.map((order) => order.totals.endingAfterTaxEstate),
      )
    : 0;

  const you = personLabel(plan, "person1");
  const spouse = personLabel(plan, "person2");
  const assumptions = plan.withdrawalAssumptions;

  return (
    <section className="space-y-4" aria-labelledby="withdrawal-order-heading">
      <div className="space-y-1">
        <h2
          id="withdrawal-order-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Withdrawal order
        </h2>
        <p className="type-small max-w-3xl text-muted-foreground">
          Four ways to draw the accounts, with federal tax, Ontario tax, and
          the OAS recovery tax each year. The lowest lifetime tax and the
          highest ending estate are marked. Neither mark is a recommendation.
        </p>
      </div>

      {missingAccounts ? (
        <RetireEmptyState
          title="Add accounts to compare withdrawal orders"
          description="Add an RRSP, TFSA, non-registered, or cash balance for each person. This section will not fill in balances for you."
        />
      ) : null}
      {!missingAccounts && missingAge ? (
        <RetireEmptyState
          title="Enter an age to compare withdrawal orders"
          description="Each person needs an age. This section will not choose one."
        />
      ) : null}
      {!missingAccounts && !missingAge && missingSpending ? (
        <RetireEmptyState
          title="Enter annual spending to compare withdrawal orders"
          description="Spending is the gap these orders fund. This section will not assume a spending amount."
        />
      ) : null}

      {comparison && selectedOrder ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {comparison.orders.map((order) => {
              const lowTax = order.totals.totalTax === lowestTax;
              const highEstate =
                order.totals.endingAfterTaxEstate === highestEstate;
              const active = order.id === selectedOrder.id;
              return (
                <Card
                  key={order.id}
                  className={cn(
                    "surface-card gap-0 py-0 shadow-none",
                    active && "border-primary",
                  )}
                >
                  <CardHeader className="gap-2 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-sm font-semibold">
                        {order.label}
                      </CardTitle>
                      {lowTax ? (
                        <Badge variant="secondary">Lowest lifetime tax</Badge>
                      ) : null}
                      {highEstate ? (
                        <Badge variant="outline">Highest ending estate</Badge>
                      ) : null}
                    </div>
                    <CardDescription className="text-xs leading-relaxed">
                      {order.summary}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 px-4 pb-4">
                    <OrderStat
                      label="Lifetime tax"
                      value={money(order.totals.totalTax, currency, rates)}
                    />
                    <OrderStat
                      label="Federal"
                      value={money(order.totals.federalTax, currency, rates)}
                    />
                    <OrderStat
                      label="Ontario"
                      value={money(order.totals.provincialTax, currency, rates)}
                    />
                    <OrderStat
                      label="OAS clawback"
                      value={money(order.totals.oasClawback, currency, rates)}
                    />
                    <OrderStat
                      label="Ending estate, after tax"
                      value={money(
                        order.totals.endingAfterTaxEstate,
                        currency,
                        rates,
                      )}
                    />
                    <OrderStat
                      label="Depletion year"
                      value={
                        order.totals.depletionYear == null
                          ? "Not depleted"
                          : String(order.totals.depletionYear)
                      }
                    />
                    <button
                      type="button"
                      className="type-small font-medium text-[var(--brand-green-text)] underline-offset-4 hover:underline"
                      onClick={() =>
                        onChange(
                          patchAssumptions(plan, { selectedOrder: order.id }),
                        )
                      }
                    >
                      {active ? "Showing this order" : "Show year by year"}
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="surface-card gap-0 py-0 shadow-none">
            <CardHeader className="gap-3 border-b border-border/60 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Year by year
                  </CardTitle>
                  <CardDescription>
                    {selectedOrder.label}. {WITHDRAWAL_OWNER_RULE}
                  </CardDescription>
                </div>
                <Select
                  value={selectedOrder.id}
                  onValueChange={(value) =>
                    onChange(
                      patchAssumptions(plan, {
                        selectedOrder: value as WithdrawalOrderId,
                      }),
                    )
                  }
                >
                  <SelectTrigger
                    className="w-full sm:w-[220px]"
                    aria-label="Withdrawal order"
                  >
                    <SelectValue placeholder="Withdrawal order" />
                  </SelectTrigger>
                  <SelectContent>
                    {WITHDRAWAL_ORDER_DETAILS.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Tabs
                value={viewer === "person2" && !plan.spouse ? "household" : viewer}
                onValueChange={(value) => setViewer(value as Viewer)}
              >
                <TabsList>
                  <TabsTrigger value="household">Household</TabsTrigger>
                  <TabsTrigger value="person1">{you}</TabsTrigger>
                  {plan.spouse ? (
                    <TabsTrigger value="person2">{spouse}</TabsTrigger>
                  ) : null}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="px-0 py-0">
              <YearTable
                order={selectedOrder}
                viewer={viewer === "person2" && !plan.spouse ? "household" : viewer}
                currency={currency}
                rates={rates}
              />
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card className="surface-card gap-0 py-0 shadow-none">
        <CardHeader className="px-4 py-4 sm:px-6">
          <CardTitle className="text-base font-semibold">Assumptions</CardTitle>
          <CardDescription>
            Province {CA_ON_TAX_2026_LABEL}, tax year {resolved?.taxYear ?? 2026}.
            Generic tax parameters, not your income or a retire date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <RetireField
              id="meltdown-target"
              label="Meltdown target income, per person"
              hint="Left as the default, this is the top of the lowest federal bracket and it indexes each year."
            >
              <CurrencyAmountInput
                id="meltdown-target"
                usdValue={
                  assumptions.meltdownTargetIncome ??
                  resolved?.meltdownTargetIncome ??
                  0
                }
                currency={currency}
                rates={rates}
                onUsdChange={(usd) =>
                  onChange(
                    patchAssumptions(plan, {
                      meltdownTargetIncome: Math.max(0, usd),
                    }),
                  )
                }
              />
            </RetireField>
            <RetireField
              id="tfsa-room"
              label="TFSA room per living person"
              hint="A flat annual cap, not real contribution room. Used only by the meltdown."
            >
              <CurrencyAmountInput
                id="tfsa-room"
                usdValue={
                  assumptions.annualTfsaRoom ?? resolved?.annualTfsaRoom ?? 0
                }
                currency={currency}
                rates={rates}
                onUsdChange={(usd) =>
                  onChange(
                    patchAssumptions(plan, { annualTfsaRoom: Math.max(0, usd) }),
                  )
                }
              />
            </RetireField>
            <RetireField
              id="gain-share"
              label="Unrealized gain share %"
              hint="Portion of a non-registered withdrawal treated as a capital gain. Cash is not a gain."
            >
              <Input
                id="gain-share"
                type="number"
                min="0"
                max="100"
                step="1"
                value={Math.round(assumptions.unrealizedGainShare * 1000) / 10}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  onChange(
                    patchAssumptions(plan, {
                      unrealizedGainShare: Math.min(1, Math.max(0, next / 100)),
                    }),
                  );
                }}
                className="tabular-nums"
              />
            </RetireField>
            <RetireField
              id="inclusion-rate"
              label="Capital gains inclusion %"
              hint="2026 statutory inclusion is 50%. Taxable gain = withdrawal × gain share × inclusion."
            >
              <Input
                id="inclusion-rate"
                type="number"
                min="0"
                max="100"
                step="1"
                value={Math.round(assumptions.capitalGainsInclusionRate * 1000) / 10}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  onChange(
                    patchAssumptions(plan, {
                      capitalGainsInclusionRate: Math.min(
                        1,
                        Math.max(0, next / 100),
                      ),
                    }),
                  );
                }}
                className="tabular-nums"
              />
            </RetireField>
          </div>
          <ul className="type-small space-y-1.5 leading-relaxed text-muted-foreground">
            <li>{"Tax brackets and credits indexed at the plan's inflation rate."}</li>
            <li>
              Inflation {plan.inflationRate}% from the plan. Each account grows
              at the return saved on that account.
            </li>
            <li>
              Stored amounts are US dollars. This comparison uses 1 USD ={" "}
              {cadPerUsd} CAD, converts into the {resolved?.taxYear ?? 2026}{" "}
              brackets, then converts the tax back.
            </li>
            <li>{WITHDRAWAL_OWNER_RULE}</li>
            {CA_TAX_LIMITATIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Bracket sources</p>
            <ul className="space-y-1">
              {CA_TAX_SOURCES.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-4 hover:underline"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <RetirementDisclaimer />
        </CardContent>
      </Card>
    </section>
  );
}

const CA_ON_TAX_2026_LABEL = "Ontario";

function OrderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function YearTable({
  order,
  viewer,
  currency,
  rates,
}: {
  order: WithdrawalOrderComparison;
  viewer: Viewer;
  currency: DisplayCurrency;
  rates: FxRates;
}) {
  const personRows =
    viewer === "household" ? null : order.rowsByPerson[viewer];
  const showPerson = viewer !== "household";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={STICKY}>
            {showPerson ? "Year / age" : "Year"}
          </TableHead>
          {showPerson ? <TableHead className={MONEY}>Alive</TableHead> : null}
          <TableHead className={MONEY}>RRSP / RRIF</TableHead>
          <TableHead className={MONEY}>TFSA</TableHead>
          <TableHead className={MONEY}>Non-registered / cash</TableHead>
          <TableHead className={MONEY}>RRIF minimum</TableHead>
          <TableHead className={MONEY}>Taxable income</TableHead>
          <TableHead className={MONEY}>Federal tax</TableHead>
          <TableHead className={MONEY}>Ontario tax</TableHead>
          <TableHead className={MONEY}>OAS clawback</TableHead>
          <TableHead className={MONEY}>Total tax</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {showPerson
          ? (personRows ?? []).map((row) => (
              <PersonCells
                key={row.year}
                row={row}
                currency={currency}
                rates={rates}
              />
            ))
          : order.householdRows.map((row) => (
              <TableRow key={row.year}>
                <TableCell className={cn(STICKY, "font-medium")}>
                  <span className="block">{row.year}</span>
                  {row.converged ? null : (
                    <span className="type-small block font-normal text-muted-foreground">
                      Tax and the withdrawal did not settle within $0.01.
                    </span>
                  )}
                </TableCell>
                <MoneyCell value={row.withdrawals.rrspRrif} currency={currency} rates={rates} />
                <MoneyCell value={row.withdrawals.tfsa} currency={currency} rates={rates} />
                <MoneyCell
                  value={row.withdrawals.nonRegisteredCash}
                  currency={currency}
                  rates={rates}
                />
                <MoneyCell value={row.rrifMinimum} currency={currency} rates={rates} />
                <MoneyCell value={row.taxableIncome} currency={currency} rates={rates} />
                <MoneyCell value={row.federalTax} currency={currency} rates={rates} />
                <MoneyCell value={row.provincialTax} currency={currency} rates={rates} />
                <MoneyCell value={row.oasClawback} currency={currency} rates={rates} />
                <MoneyCell value={row.totalTax} currency={currency} rates={rates} />
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}

function PersonCells({
  row,
  currency,
  rates,
}: {
  row: PersonWithdrawalYearRow;
  currency: DisplayCurrency;
  rates: FxRates;
}) {
  return (
    <TableRow>
      <TableCell className={cn(STICKY, "font-medium")}>
        <span className="block">{row.year}</span>
        <span className="type-small block font-normal text-muted-foreground">
          Age {row.age}
        </span>
        {row.converged ? null : (
          <span className="type-small block font-normal text-muted-foreground">
            Tax and the withdrawal did not settle within $0.01.
          </span>
        )}
      </TableCell>
      <TableCell className={MONEY}>{row.alive ? "Yes" : "No"}</TableCell>
      <MoneyCell value={row.withdrawals.rrspRrif} currency={currency} rates={rates} />
      <MoneyCell value={row.withdrawals.tfsa} currency={currency} rates={rates} />
      <MoneyCell
        value={row.withdrawals.nonRegisteredCash}
        currency={currency}
        rates={rates}
      />
      <MoneyCell value={row.rrifMinimum} currency={currency} rates={rates} />
      <MoneyCell value={row.taxableIncome} currency={currency} rates={rates} />
      <MoneyCell value={row.federalTax} currency={currency} rates={rates} />
      <MoneyCell value={row.provincialTax} currency={currency} rates={rates} />
      <MoneyCell value={row.oasClawback} currency={currency} rates={rates} />
      <MoneyCell value={row.totalTax} currency={currency} rates={rates} />
    </TableRow>
  );
}

function MoneyCell({
  value,
  currency,
  rates,
}: {
  value: number;
  currency: DisplayCurrency;
  rates: FxRates;
}) {
  return <TableCell className={MONEY}>{money(value, currency, rates)}</TableCell>;
}
