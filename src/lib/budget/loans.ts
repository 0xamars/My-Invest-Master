import { isLoanAccount } from "@/lib/budget/accounts";
import {
  STARTING_BALANCE_PAYEE,
  buildStartingBalanceTransaction,
} from "@/lib/budget/starting-balance";
import type {
  BudgetAccount,
  BudgetAccountType,
  BudgetInterestRate,
  BudgetPlan,
  BudgetTransaction,
} from "@/types/budget";

export const INTEREST_ESTIMATE_NOTE =
  "A simple estimate from the balance owed and the annual rate divided by 12. Educational only, not a payment schedule or advice.";

export interface LoanTermsDraft {
  interestRates: BudgetInterestRate[];
  minimumPayment: number | null;
  paymentDueDay: number | null;
  openingBalance: { amount: number; date: string } | null;
}

export interface LoanTermsSnapshot {
  openingBalance: number | null;
  openingBalanceDate: string | null;
  currentRate: BudgetInterestRate | null;
  /** Earlier rates, oldest first. Does not include the current rate. */
  earlierRates: BudgetInterestRate[];
  /** Rates that start after `asOf`, oldest first. */
  laterRates: BudgetInterestRate[];
  minimumPayment: number | null;
  paymentDueDay: number | null;
  /** Null when there is no rate in effect, or the balance is a credit. */
  estimatedInterest: number | null;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string | undefined): value is string {
  return typeof value === "string" && DATE_KEY.test(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function normalizeInterestRates(
  rates: BudgetInterestRate[] | undefined,
): BudgetInterestRate[] | undefined {
  if (!rates || rates.length === 0) return undefined;
  const byDate = new Map<string, number>();
  for (const rate of rates) {
    if (!rate || !isDateKey(rate.effectiveDate)) continue;
    if (!Number.isFinite(rate.annualPercent)) continue;
    if (rate.annualPercent < 0 || rate.annualPercent > 100) continue;
    byDate.set(rate.effectiveDate, roundPercent(rate.annualPercent));
  }
  if (byDate.size === 0) return undefined;
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([effectiveDate, annualPercent]) => ({ effectiveDate, annualPercent }));
}

export function normalizeMinimumPayment(
  value: number | null | undefined,
): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  return roundMoney(value);
}

export function normalizePaymentDueDay(
  value: number | null | undefined,
): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  const day = Math.trunc(value);
  if (day < 1 || day > 31) return undefined;
  return day;
}

export function normalizeOpeningBalance(
  value: number | null | undefined,
): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  return roundMoney(value);
}

/** Rate in effect on `asOf`. A future rate is not used early. */
export function interestRateOn(
  rates: BudgetInterestRate[] | undefined,
  asOf: string,
): BudgetInterestRate | null {
  const history = normalizeInterestRates(rates);
  if (!history || !isDateKey(asOf)) return null;
  let current: BudgetInterestRate | null = null;
  for (const rate of history) {
    if (rate.effectiveDate <= asOf) current = rate;
  }
  return current;
}

/**
 * Next month of interest: balance × annual rate ÷ 12, rounded to cents.
 * Returns null when the rate is missing or the balance is a credit.
 * A zero balance with a real rate returns 0.
 */
export function estimateNextMonthlyInterest(
  balance: number,
  annualPercent: number | null,
): number | null {
  if (annualPercent == null || !Number.isFinite(annualPercent)) return null;
  if (!Number.isFinite(balance) || balance < 0) return null;
  if (balance === 0) return 0;
  const cents = Math.round((balance * (annualPercent / 100) * 100) / 12);
  return cents / 100;
}

export function readLoanTerms(
  account: Pick<
    BudgetAccount,
    | "interestRates"
    | "minimumPayment"
    | "paymentDueDay"
    | "openingBalance"
    | "openingBalanceDate"
  >,
  balance: number,
  asOf: string,
): LoanTermsSnapshot {
  const history = normalizeInterestRates(account.interestRates) ?? [];
  const currentRate = interestRateOn(history, asOf);
  const openingBalance = normalizeOpeningBalance(account.openingBalance) ?? null;
  const openingBalanceDate =
    openingBalance != null && isDateKey(account.openingBalanceDate)
      ? account.openingBalanceDate
      : null;
  return {
    openingBalance,
    openingBalanceDate,
    currentRate,
    earlierRates: currentRate
      ? history.filter((rate) => rate.effectiveDate < currentRate.effectiveDate)
      : [],
    laterRates: history.filter((rate) => rate.effectiveDate > asOf),
    minimumPayment: normalizeMinimumPayment(account.minimumPayment) ?? null,
    paymentDueDay: normalizePaymentDueDay(account.paymentDueDay) ?? null,
    estimatedInterest: estimateNextMonthlyInterest(
      balance,
      currentRate?.annualPercent ?? null,
    ),
  };
}

export function loanFieldsFromDraft(
  type: BudgetAccountType,
  draft: LoanTermsDraft | undefined,
): Pick<
  BudgetAccount,
  | "interestRates"
  | "minimumPayment"
  | "paymentDueDay"
  | "openingBalance"
  | "openingBalanceDate"
> {
  if (!isLoanAccount(type) || !draft) return {};
  const openingAmount = normalizeOpeningBalance(draft.openingBalance?.amount);
  const openingDate =
    openingAmount != null && isDateKey(draft.openingBalance?.date)
      ? draft.openingBalance.date
      : undefined;
  return {
    interestRates: normalizeInterestRates(draft.interestRates),
    minimumPayment: normalizeMinimumPayment(draft.minimumPayment),
    paymentDueDay: normalizePaymentDueDay(draft.paymentDueDay),
    openingBalance: openingDate ? openingAmount : undefined,
    openingBalanceDate: openingDate,
  };
}

export function withLoanFields(
  account: BudgetAccount,
  draft: LoanTermsDraft | undefined,
): BudgetAccount {
  if (!draft || !isLoanAccount(account.type)) return account;
  return {
    ...account,
    ...loanFieldsFromDraft(account.type, draft),
  };
}

/**
 * Keep the opening balance and the Starting Balance transaction in step.
 * Other register rows are left alone.
 */
export function syncOpeningBalanceTransaction(
  transactions: BudgetTransaction[],
  account: Pick<BudgetAccount, "id" | "type">,
  opening: { amount: number; date: string } | null,
): BudgetTransaction[] {
  const matches = transactions.filter(
    (tx) => tx.accountId === account.id && tx.payee === STARTING_BALANCE_PAYEE,
  );
  const rest = transactions.filter(
    (tx) => !(tx.accountId === account.id && tx.payee === STARTING_BALANCE_PAYEE),
  );
  const amount = normalizeOpeningBalance(opening?.amount);
  const date = opening && isDateKey(opening.date) ? opening.date : undefined;
  if (amount == null || !date) return rest;

  const built = buildStartingBalanceTransaction({
    id: matches[0]?.id ?? crypto.randomUUID(),
    account,
    amount,
    date,
  });
  if (!built) return transactions;
  const kept: BudgetTransaction = matches[0]
    ? { ...built, cleared: matches[0].cleared, approved: matches[0].approved }
    : built;
  return [...rest, kept];
}

export function applyLoanTermsToPlan(
  plan: BudgetPlan,
  accountId: string,
  draft: LoanTermsDraft,
): BudgetPlan {
  const current = plan.accounts.find((account) => account.id === accountId);
  if (!current) return plan;
  const nextAccount = withLoanFields(
    { ...current },
    draft,
  );
  if (!isLoanAccount(nextAccount.type)) return plan;
  const accounts = plan.accounts.map((account) =>
    account.id === accountId ? nextAccount : account,
  );
  return {
    ...plan,
    accounts,
    transactions: syncOpeningBalanceTransaction(
      plan.transactions,
      nextAccount,
      draft.openingBalance,
    ),
  };
}
