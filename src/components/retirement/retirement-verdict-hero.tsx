import type { ReactNode } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { ImagineSlot } from "@/components/brand/imagine-slot";
import { EmptyArt } from "@/components/journey/empty-art";
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
import { retirementInputPrompt } from "@/lib/retirement/inputs";
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
  portfolioLabel = "Book + leftover",
  emptyTitle = "Leftover or the book is missing",
  emptyDescription = "Retire uses Budget leftover plus the Invest book. It will not invent cash.",
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
  portfolioLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  currentYear?: number;
}) {
  const money = (value: number) => formatProjectionMoney(value, currency, rates);
  const hasInputs = leftover != null && book != null;
  const inputPrompt = retirementInputPrompt(dashboard.missingInputs);

  if (inputPrompt) {
    return (
      <RetirePanel className="px-5 py-5">
        <RetireEmptyState
          art={<EmptyArt kind="retire" />}
          icon={<Wallet className="size-5" />}
          title={inputPrompt.title}
          description={inputPrompt.description}
        />
      </RetirePanel>
    );
  }

  const annualSpending = dashboard.annualSpending ?? 0;
  const targetNestEgg = dashboard.targetNestEgg ?? 0;
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
        <div className="px-5 py-5">
        <RetireEmptyState
          art={<EmptyArt kind="retire" />}
          icon={<Wallet className="size-5" />}
          title={emptyTitle}
          description={emptyDescription}
          actions={emptyActions}
        />
        </div>
        <div className="border-t border-border/60 px-5 py-4 text-sm text-muted-foreground">
          You need{" "}
          <span className="font-semibold text-foreground">
            {money(targetNestEgg)}
          </span>{" "}
          to spend {money(annualSpending)}/year at{" "}
          {dashboard.withdrawalRate}%.
        </div>
      </RetirePanel>
    );
  }

  return (
    <div className="budget-panel">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <section className="border-b border-border px-4 py-4 lg:border-b-0 lg:border-r sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <RetireVerdictChip verdict={dashboard.verdict} />
          {planName ? (
            <span className="text-xs text-muted-foreground">{planName}</span>
          ) : null}
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
        <p
          className={cn(
            "hero-lead",
            dashboard.verdict === "behind" || dashboard.verdict === "empty"
              ? "text-[var(--brand-orange-text)]"
              : "text-[var(--brand-green-text)]",
          )}
        >
          {dashboard.verdict === "empty" ? "No date yet" : dateLabel}
        </p>
        <ImagineSlot slot="hero-retire" size="hero" />
        </div>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {impliedPathSentence(dashboard, money)}
        </p>
        {dashboard.freedomAge != null && dashboard.yearsToFreedom !== 0 ? (
          <p className="mt-2 text-sm font-medium">Age {dashboard.freedomAge}</p>
        ) : null}
        {leverText ? (
          <p className="mt-2 text-sm font-medium">{leverText}</p>
        ) : null}
        {dashboard.requiredGrowthRate != null ? (
          <p className="mt-2 text-sm font-medium">
            {dashboard.requiredGrowthRate <= 0
              ? "The target is already covered at 0% growth."
              : `Needs ${dashboard.requiredGrowthRate.toFixed(1)}% a year to reach the target by the target age.`}
          </p>
        ) : dashboard.verdict !== "empty" && targetNestEgg > 0 ? (
          <p className="mt-2 text-sm font-medium">
            Not reachable by the target age at 40% growth.
          </p>
        ) : null}
        {dashboard.gapToday != null ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {dashboard.gapToday >= 0
              ? `${money(dashboard.gapToday)} ahead of the target, in today's dollars.`
              : `${money(Math.abs(dashboard.gapToday))} short of the target, in today's dollars.`}
          </p>
        ) : null}
        {href ? (
          <Button className="mt-4" render={<Link href={href} />}>
            Open plan
          </Button>
        ) : null}
      </section>

      <div className="grid">
        {hasInputs ? <FreedomInputsStrip leftover={leftover} book={book} /> : null}
        <div className="grid grid-cols-2 divide-x divide-y divide-border">
          <Metric
            label="Target nest egg"
            value={money(targetNestEgg)}
            hint={`${money(annualSpending)}/year at ${dashboard.withdrawalRate}%`}
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
            label={portfolioLabel}
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
        </div>
      </div>
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
    <div className="grid grid-cols-1 divide-y divide-border border-b border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
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
    </div>
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
