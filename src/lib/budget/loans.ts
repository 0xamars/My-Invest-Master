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

const LOAN_ONLY_FIELDS = [
  "interestRates",
  "minimumPayment",
  "paymentDueDay",
  "openingBalance",
  "openingBalanceDate",
] as const;

/** Drop rate, minimum, due day, and opening-balance fields. The register is untouched. */
export function stripLoanFields(account: BudgetAccount): BudgetAccount {
  const next: BudgetAccount = { ...account };
  for (const key of LOAN_ONLY_FIELDS) {
    delete next[key];
  }
  return next;
}

export function accountWithEdits(
  account: BudgetAccount,
  updates: {
    name?: string;
    type?: BudgetAccountType;
    onBudget?: boolean;
  },
): BudgetAccount {
  const type = updates.type ?? account.type;
  const next: BudgetAccount = {
    ...account,
    name: updates.name?.trim() || account.name,
    type,
    onBudget: updates.onBudget ?? account.onBudget,
  };
  return isLoanAccount(type) ? next : stripLoanFields(next);
}

function startingBalanceRows(
  transactions: BudgetTransaction[],
  accountId: string,
): BudgetTransaction[] {
  return transactions.filter(
    (tx) => tx.accountId === accountId && tx.payee === STARTING_BALANCE_PAYEE,
  );
}

export function startingBalanceIsReconciled(
  transactions: BudgetTransaction[],
  accountId: string,
): boolean {
  return startingBalanceRows(transactions, accountId).some(
    (tx) => tx.cleared === "reconciled",
  );
}

/**
 * Keep a new opening balance and the Starting Balance transaction in step.
 * Clearing the field does not delete an existing row. A reconciled row,
 * including its memo, is left alone. Other register rows are left alone.
 */
export function syncOpeningBalanceTransaction(
  transactions: BudgetTransaction[],
  account: Pick<BudgetAccount, "id" | "type">,
  opening: { amount: number; date: string } | null,
): BudgetTransaction[] {
  const matches = startingBalanceRows(transactions, account.id);
  if (matches.some((tx) => tx.cleared === "reconciled")) return transactions;

  const amount = normalizeOpeningBalance(opening?.amount);
  const date = opening && isDateKey(opening.date) ? opening.date : undefined;
  if (amount == null || !date) return transactions;

  const target = matches[0];
  const built = buildStartingBalanceTransaction({
    id: target?.id ?? crypto.randomUUID(),
    account,
    amount,
    date,
  });
  if (!built) return transactions;
  if (!target) return [...transactions, built];

  const kept: BudgetTransaction = {
    ...built,
    cleared: target.cleared,
    approved: target.approved,
    memo: target.memo,
  };
  return transactions.map((tx) => (tx.id === target.id ? kept : tx));
}

export function applyLoanTermsToPlan(
  plan: BudgetPlan,
  accountId: string,
  draft: LoanTermsDraft,
): BudgetPlan {
  const current = plan.accounts.find((account) => account.id === accountId);
  if (!current || !isLoanAccount(current.type)) return plan;

  const reconciled = startingBalanceIsReconciled(plan.transactions, accountId);
  const fields = loanFieldsFromDraft(current.type, draft);
  const nextAccount: BudgetAccount = {
    ...current,
    interestRates: fields.interestRates,
    minimumPayment: fields.minimumPayment,
    paymentDueDay: fields.paymentDueDay,
    openingBalance: reconciled ? current.openingBalance : fields.openingBalance,
    openingBalanceDate: reconciled
      ? current.openingBalanceDate
      : fields.openingBalanceDate,
  };
  const accounts = plan.accounts.map((account) =>
    account.id === accountId ? nextAccount : account,
  );
  return {
    ...plan,
    accounts,
    transactions: reconciled
      ? plan.transactions
      : syncOpeningBalanceTransaction(
          plan.transactions,
          nextAccount,
          draft.openingBalance,
        ),
  };
}

export function applyAccountEdits(
  plan: BudgetPlan,
  accountId: string,
  updates: {
    name?: string;
    type?: BudgetAccountType;
    onBudget?: boolean;
    loan?: LoanTermsDraft;
  },
): BudgetPlan {
  const renamed: BudgetPlan = {
    ...plan,
    accounts: plan.accounts.map((account) =>
      account.id === accountId ? accountWithEdits(account, updates) : account,
    ),
  };
  const edited = renamed.accounts.find((account) => account.id === accountId);
  if (!updates.loan || !edited || !isLoanAccount(edited.type)) return renamed;
  return applyLoanTermsToPlan(renamed, accountId, updates.loan);
}
