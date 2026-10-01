"use client";

import { isLoanAccount } from "@/lib/budget/accounts";
import { formatBudgetDate, formatBudgetMoney } from "@/lib/budget/format";
import {
  INTEREST_ESTIMATE_NOTE,
  readLoanTerms,
} from "@/lib/budget/loans";
import type { BudgetAccount } from "@/types/budget";

function todayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value)}%`;
}

export function LoanAccountSummary({
  account,
  balance,
  currency,
  asOf = todayKey(),
}: {
  account: BudgetAccount;
  balance: number;
  currency?: string;
  asOf?: string;
}) {
  if (!isLoanAccount(account.type)) return null;
  const terms = readLoanTerms(account, balance, asOf);
  const money = (value: number) => formatBudgetMoney(value, currency);

  return (
    <div className="mt-2 space-y-1 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <p>
        Balance owed{" "}
        <span className="font-medium text-foreground">{money(balance)}</span>
      </p>
      <p>
        Opening balance{" "}
        {terms.openingBalance == null ? (
          "not set"
        ) : (
          <span className="font-medium text-foreground">
            {money(terms.openingBalance)}
            {terms.openingBalanceDate
              ? ` as of ${formatBudgetDate(terms.openingBalanceDate)}`
              : ""}
          </span>
        )}
      </p>
      <p>
        Interest rate{" "}
        {terms.currentRate == null ? (
          "not set"
        ) : (
          <span className="font-medium text-foreground">
            {formatPercent(terms.currentRate.annualPercent)} as of{" "}
            {formatBudgetDate(terms.currentRate.effectiveDate)}
          </span>
        )}
      </p>
      {terms.earlierRates.length > 0 ? (
        <p>
          Earlier rates kept:{" "}
          {terms.earlierRates
            .map(
              (rate) =>
                `${formatPercent(rate.annualPercent)} from ${formatBudgetDate(rate.effectiveDate)}`,
            )
            .join(", ")}
        </p>
      ) : null}
      {terms.laterRates.length > 0 ? (
        <p>
          Later rates kept:{" "}
          {terms.laterRates
            .map(
              (rate) =>
                `${formatPercent(rate.annualPercent)} from ${formatBudgetDate(rate.effectiveDate)}`,
            )
            .join(", ")}
        </p>
      ) : null}
      <p>
        Minimum payment{" "}
        {terms.minimumPayment == null ? (
          "not set"
        ) : (
          <span className="font-medium text-foreground">
            {money(terms.minimumPayment)}
          </span>
        )}
      </p>
      <p>
        Payment due day{" "}
        {terms.paymentDueDay == null ? (
          "not set"
        ) : (
          <span className="font-medium text-foreground">
            day {terms.paymentDueDay}
          </span>
        )}
      </p>
      {terms.currentRate == null ? (
        <p>Estimated interest next month is not shown until a rate is set.</p>
      ) : terms.estimatedInterest == null ? (
        <p>
          Estimated interest next month is not shown while this balance is a
          credit.
        </p>
      ) : (
        <p>
          Estimated interest next month{" "}
          <span className="font-medium text-foreground">
            {money(terms.estimatedInterest)}
          </span>
          . {INTEREST_ESTIMATE_NOTE}
        </p>
      )}
    </div>
  );
}
