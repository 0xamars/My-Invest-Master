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
import { formatBudgetMoney } from "@/lib/budget/format";
import type { LeftoverPresence } from "@/lib/invest/leftover";
import type { RetirementDashboard } from "@/lib/retirement/dashboard";
import {
  formatFreedomDate,
  freedomLeverSentence,
  type BookPresence,
  type FreedomLever,
} from "@/lib/retirement/freedom-path";
import { formatProjectionMoney } from "@/lib/retirement/format";
import { impliedPathSentence } from "@/lib/retirement/path-copy";
import { cn } from "@/lib/utils";
import type { DisplayCurrency, FxRates } from "@/types/currency";

export function RetirementVerdictHero({
  dashboard,
  currency,
  rates,
  planName,
  emptyActions,
  href,
  leftover,
  book,
  lever,
  currentYear = new Date().getFullYear(),
}: {
  dashboard: RetirementDashboard;
  currency: DisplayCurrency;
  rates: FxRates;
  planName?: string;
  emptyActions?: ReactNode;
  href?: string;
  leftover?: LeftoverPresence;
  book?: BookPresence;
  lever?: FreedomLever;
  currentYear?: number;
}) {
  const money = (value: number) => formatProjectionMoney(value, currency, rates);
  const hasInputs = leftover != null && book != null;
  const dateLabel = formatFreedomDate(
    dashboard.freedomYear == null
      ? null
      : { year: dashboard.freedomYear },
    currentYear,
  );
  const leverText = lever ? freedomLeverSentence(lever) : null;

  if (dashboard.verdict === "empty" && !hasInputs) {
    return (
      <RetirePanel>
        <RetireEmptyState
          icon={<Wallet className="size-5" />}
          title="Leftover or the book is missing"
          description="Freedom uses Budget leftover plus the Invest book. It will not invent cash."
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
            dashboard.verdict === "behind" || dashboard.verdict === "empty"
              ? "text-[var(--brand-orange)]"
              : "text-[var(--brand-green)]",
          )}
        >
          {dashboard.verdict === "empty" ? "No date yet" : dateLabel}
        </p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {impliedPathSentence(dashboard, money)}
        </p>
        {dashboard.freedomAge != null && dashboard.yearsToFreedom !== 0 ? (
          <p className="mt-2 text-sm font-medium">Age {dashboard.freedomAge}</p>
        ) : null}
        {leverText ? (
          <p className="mt-2 text-sm font-medium">{leverText}</p>
        ) : null}
        {href ? (
          <Button className="mt-4" render={<Link href={href} />}>
            Open plan
          </Button>
        ) : null}
      </section>

      <div className="grid gap-3">
        {hasInputs ? <FreedomInputsStrip leftover={leftover} book={book} /> : null}
        <RetirePanel className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-2">
          <Metric
            label="Target nest egg"
            value={money(dashboard.targetNestEgg)}
            hint={`${money(dashboard.annualSpending)}/year at ${dashboard.withdrawalRate}%`}
          />
          <Metric
            label="On this path"
            value={
              dashboard.verdict === "empty"
                ? "—"
                : dashboard.verdict === "ahead"
                  ? "Ahead"
                  : dashboard.verdict === "behind"
                    ? "Behind"
                    : "On track"
            }
          />
          <Metric
            label="Book + leftover"
            value={
              dashboard.verdict === "empty" && dashboard.currentPortfolio <= 0
                ? "—"
                : money(dashboard.currentPortfolio)
            }
          />
          <Metric
            label="At the date"
            value={
              dashboard.projectedNestEgg == null
                ? "—"
                : money(dashboard.projectedNestEgg)
            }
          />
        </RetirePanel>
      </div>
    </div>
  );
}

function FreedomInputsStrip({
  leftover,
  book,
}: {
  leftover: LeftoverPresence;
  book: BookPresence;
}) {
  return (
    <RetirePanel className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      <InputStatus
        label="Leftover"
        value={leftoverLabel(leftover)}
        missing={leftover.status !== "present"}
      />
      <InputStatus
        label="Book"
        value={
          book.status === "present"
            ? book.portfolioName
            : "Missing — add holdings in Invest"
        }
        hint={
          book.status === "present"
            ? `${book.holdings.length} holding${book.holdings.length === 1 ? "" : "s"}`
            : undefined
        }
        missing={book.status !== "present"}
      />
    </RetirePanel>
  );
}

function leftoverLabel(leftover: LeftoverPresence): string {
  if (leftover.status === "missing-budget") return "Missing — no Budget yet";
  if (leftover.status === "none") return "Missing — none this month";
  return `${formatBudgetMoney(leftover.amount, leftover.currency)} this month`;
}

function InputStatus({
  label,
  value,
  hint,
  missing,
}: {
  label: string;
  value: string;
  hint?: string;
  missing: boolean;
}) {
  return (
    <div className="flex flex-col justify-center px-4 py-4 sm:px-5">
      <p className="budget-metric-label">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-sm font-medium tracking-tight",
          missing ? "text-[var(--brand-orange)]" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
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
