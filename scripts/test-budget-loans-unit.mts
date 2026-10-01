/**
 * Loans, mortgages, categorized payments off-budget, rate history, net worth, Ready to Assign.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-loans-unit.mts
 */
import {
  defaultOnBudgetForType,
  getAccountBalance,
  isLiabilityAccount,
} from "../src/lib/budget/accounts.ts";
import {
  computeMonthSummary,
  getCategoryAvailable,
  getReadyToAssign,
} from "../src/lib/budget/calculations.ts";
import {
  applyAccountEdits,
  applyLoanTermsToPlan,
  estimateNextMonthlyInterest,
  interestRateOn,
  normalizeInterestRates,
  readLoanTerms,
  syncOpeningBalanceTransaction,
} from "../src/lib/budget/loans.ts";
import {
  ensureCreditCardPaymentCategories,
  paymentCategoryForAccount,
} from "../src/lib/budget/credit-card-payments.ts";
import { envelopeRequiredForTransfer, transferLeavesBudget } from "../src/lib/budget/on-budget.ts";
import { STARTING_BALANCE_PAYEE } from "../src/lib/budget/starting-balance.ts";
import { normalizeBudgetPlan } from "../src/lib/budget/migrate-plan.ts";
import { getNetWorthSnapshot, getSpendingByCategory } from "../src/lib/budget/reports.ts";
import { materializeDueSchedules } from "../src/lib/budget/scheduled.ts";
import { getTransactionDisplay } from "../src/lib/budget/transactions.ts";
import type {
  BudgetAccount,
  BudgetPlan,
  BudgetTransaction,
} from "../src/types/budget.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

assert(defaultOnBudgetForType("auto-loan") === false, "Auto loan defaults off-budget");
assert(defaultOnBudgetForType("mortgage") === false, "Mortgage defaults off-budget");
assert(
  defaultOnBudgetForType("line-of-credit") === false,
  "Line of credit defaults off-budget",
);
assert(defaultOnBudgetForType("credit-card") === true, "Credit card still defaults on-budget");
assert(defaultOnBudgetForType("chequing") === true, "Chequing still defaults on-budget");
assert(isLiabilityAccount("auto-loan"), "Auto loan is a liability");

const chequing: BudgetAccount = {
  id: "acct-chequing",
  name: "Chequing",
  type: "chequing",
  onBudget: true,
  sortOrder: 0,
};
const mortgage: BudgetAccount = {
  id: "acct-mortgage",
  name: "House mortgage",
  type: "mortgage",
  onBudget: false,
  sortOrder: 1,
  openingBalance: 200000,
  openingBalanceDate: "2026-01-01",
  interestRates: [{ effectiveDate: "2026-01-01", annualPercent: 5 }],
  minimumPayment: 1500,
  paymentDueDay: 15,
};
const autoLoan: BudgetAccount = {
  id: "acct-auto",
  name: "Car loan",
  type: "auto-loan",
  onBudget: false,
  sortOrder: 2,
  interestRates: [
    { effectiveDate: "2026-01-01", annualPercent: 6.5 },
    { effectiveDate: "2026-06-01", annualPercent: 4.9 },
  ],
};

function tx(
  partial: Pick<BudgetTransaction, "id" | "date" | "amount" | "type"> &
    Partial<BudgetTransaction>,
): BudgetTransaction {
  return {
    payee: partial.payee ?? "Payee",
    accountId: partial.accountId ?? chequing.id,
    categoryId: partial.categoryId ?? null,
    cleared: partial.cleared ?? "cleared",
    approved: true,
    ...partial,
  };
}

function makePlan(overrides: Partial<BudgetPlan> = {}): BudgetPlan {
  return {
    id: "plan-1",
    name: "Plan",
    accounts: [chequing, mortgage],
    categoryGroups: [{ id: "g1", name: "Bills", sortOrder: 0 }],
    categories: [
      { id: "mortgage-cat", groupId: "g1", name: "Mortgage", sortOrder: 0 },
      { id: "groceries", groupId: "g1", name: "Groceries", sortOrder: 1 },
    ],
    transactions: [],
    scheduledTransactions: [],
    monthBudgets: {},
    goals: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const funded = makePlan({
  transactions: [
    tx({
      id: "income",
      date: "2026-01-02",
      amount: 10000,
      type: "inflow",
      accountId: chequing.id,
    }),
    tx({
      id: "open-mortgage",
      date: "2026-01-01",
      amount: 200000,
      type: "outflow",
      accountId: mortgage.id,
      payee: "Starting Balance",
    }),
  ],
  monthBudgets: { "2026-01": { assignments: { "mortgage-cat": 1500 } } },
});

assert(
  getReadyToAssign(funded, "2026-01") === 8500,
  "Ready to Assign is income minus the mortgage assignment (10000 − 1500)",
);
assert(
  getCategoryAvailable(funded, "mortgage-cat", "2026-01") === 1500,
  "Mortgage envelope holds the assignment before the payment",
);
assert(
  getAccountBalance(mortgage, funded.transactions) === 200000,
  "Opening outflow is the balance owed",
);

const paid = {
  ...funded,
  transactions: [
    ...funded.transactions,
    tx({
      id: "pay-mortgage",
      date: "2026-01-15",
      amount: 1500,
      type: "transfer",
      accountId: chequing.id,
      transferAccountId: mortgage.id,
      categoryId: "mortgage-cat",
      payee: "Transfer to House mortgage",
    }),
  ],
};

assert(
  getReadyToAssign(paid, "2026-01") === 8500,
  "Categorized loan payment does not change Ready to Assign",
);
assert(
  getCategoryAvailable(paid, "mortgage-cat", "2026-01") === 0,
  "Categorized loan payment spends the Mortgage envelope",
);
assert(
  getAccountBalance(chequing, paid.transactions) === 8500,
  "Payment leaves the on-budget account (10000 − 1500)",
);
assert(
  getAccountBalance(mortgage, paid.transactions) === 198500,
  "Payment reduces the balance owed (200000 − 1500)",
);
assert(
  computeMonthSummary(paid, "2026-01").totalSpent === 1500,
  "Categorized loan payment counts as spending",
);
assert(
  getSpendingByCategory(paid, "2026-01").some(
    (row) => row.categoryId === "mortgage-cat" && row.amount === 1500,
  ),
  "Mortgage envelope shows the payment in spending",
);

const beforePay = getNetWorthSnapshot(
  funded.accounts,
  funded.transactions,
  "2026-01",
);
const afterPay = getNetWorthSnapshot(paid.accounts, paid.transactions, "2026-01");
assert(
  beforePay.assets === 10000 &&
    beforePay.liabilities === 200000 &&
    beforePay.netWorth === -190000,
  "Net worth before the payment is cash minus the mortgage",
);
assert(
  afterPay.assets === 8500 &&
    afterPay.liabilities === 198500 &&
    afterPay.netWorth === -190000,
  "Loan payment lowers cash and the balance owed by the same amount, so net worth stays",
);

const uncategorized = {
  ...funded,
  transactions: [
    ...funded.transactions,
    tx({
      id: "old-transfer",
      date: "2026-01-20",
      amount: 200,
      type: "transfer",
      accountId: chequing.id,
      transferAccountId: mortgage.id,
      categoryId: null,
    }),
  ],
};
assert(
  getReadyToAssign(uncategorized, "2026-01") === 8300,
  "An uncategorized transfer to a loan still reduces Ready to Assign",
);
assert(
  getCategoryAvailable(uncategorized, "mortgage-cat", "2026-01") === 1500,
  "An uncategorized transfer does not spend the Mortgage envelope",
);

const brokeragePay = makePlan({
  accounts: [
    chequing,
    {
      id: "acct-broker",
      name: "Brokerage",
      type: "brokerage",
      onBudget: false,
      sortOrder: 3,
    },
  ],
  transactions: [
    tx({
      id: "income",
      date: "2026-01-02",
      amount: 1000,
      type: "inflow",
    }),
    tx({
      id: "to-broker",
      date: "2026-01-10",
      amount: 200,
      type: "transfer",
      transferAccountId: "acct-broker",
      categoryId: "groceries",
    }),
  ],
  monthBudgets: { "2026-01": { assignments: { groceries: 200 } } },
});
assert(
  transferLeavesBudget(chequing, brokeragePay.accounts[1]) === false,
  "A transfer to an off-budget investment account does not require an envelope",
);
assert(
  getReadyToAssign(brokeragePay, "2026-01") === 600,
  "A transfer to an off-budget investment account reduces Ready to Assign (1000 − 200 assigned − 200 transfer)",
);
assert(
  getCategoryAvailable(brokeragePay, "groceries", "2026-01") === 200,
  "A transfer to an off-budget investment account does not spend the envelope",
);

const autoPlan = makePlan({
  accounts: [chequing, autoLoan],
  transactions: [
    tx({
      id: "auto-income",
      date: "2026-01-02",
      amount: 400,
      type: "inflow",
      accountId: chequing.id,
    }),
    tx({
      id: "auto-open",
      date: "2026-01-01",
      amount: 12000,
      type: "outflow",
      accountId: autoLoan.id,
      payee: "Starting Balance",
    }),
    tx({
      id: "auto-pay",
      date: "2026-06-02",
      amount: 400,
      type: "transfer",
      accountId: chequing.id,
      transferAccountId: autoLoan.id,
      categoryId: "mortgage-cat",
    }),
  ],
});
const autoWorth = getNetWorthSnapshot(
  autoPlan.accounts,
  autoPlan.transactions,
  "2026-06",
);
assert(
  getAccountBalance(autoLoan, autoPlan.transactions) === 11600 &&
    autoWorth.liabilityAccounts.some((row) => row.account.id === autoLoan.id) &&
    autoWorth.liabilities === 11600 &&
    autoWorth.assets === 0 &&
    autoWorth.netWorth === -11600,
  "Auto loan stays a liability and the payment reduces it",
);

const history = normalizeInterestRates([
  { effectiveDate: "2026-06-01", annualPercent: 4.9 },
  { effectiveDate: "2026-01-01", annualPercent: 6.5 },
  { effectiveDate: "2026-06-01", annualPercent: 4.25 },
  { effectiveDate: "2026-09-01", annualPercent: 150 },
  { effectiveDate: "not-a-date", annualPercent: 3 },
]);
assert(
  history?.length === 2 &&
    history[0]?.annualPercent === 6.5 &&
    history[1]?.annualPercent === 4.25,
  "Rate history keeps earlier dates and replaces the same date; invalid rates drop",
);
assert(
  interestRateOn(history, "2026-03-01")?.annualPercent === 6.5,
  "March still uses the January rate",
);
assert(
  interestRateOn(history, "2026-06-01")?.annualPercent === 4.25,
  "June uses the rate that starts that day",
);
assert(
  interestRateOn(history, "2025-12-01") == null,
  "A date before any rate does not invent one",
);
assert(
  interestRateOn([{ effectiveDate: "2026-12-01", annualPercent: 3 }], "2026-06-01") ==
    null,
  "A future rate is not used early",
);

const terms = readLoanTerms(autoLoan, 11600, "2026-06-02");
assert(
  terms.currentRate?.annualPercent === 4.9 &&
    terms.earlierRates.length === 1 &&
    terms.earlierRates[0]?.annualPercent === 6.5,
  "Reading terms keeps the earlier rate beside the current one",
);
assert(
  estimateNextMonthlyInterest(11600, 4.9) === 47.37,
  "Estimated interest is balance × annual rate ÷ 12 (11600 × 4.9% ÷ 12)",
);
assert(
  readLoanTerms(
    { ...autoLoan, interestRates: undefined },
    11600,
    "2026-06-02",
  ).estimatedInterest == null,
  "No rate means no estimated interest",
);
assert(
  estimateNextMonthlyInterest(0, 5) === 0,
  "A zero balance with a real rate estimates zero",
);
assert(
  estimateNextMonthlyInterest(-50, 5) == null,
  "A credit balance does not invent a positive interest figure",
);
assert(
  readLoanTerms(
    {
      ...mortgage,
      minimumPayment: undefined,
      paymentDueDay: undefined,
      openingBalance: undefined,
    },
    200000,
    "2026-01-15",
  ).minimumPayment == null &&
    readLoanTerms(
      {
        ...mortgage,
        minimumPayment: undefined,
        paymentDueDay: undefined,
        openingBalance: undefined,
      },
      200000,
      "2026-01-15",
    ).openingBalance == null,
  "Empty minimum payment and opening balance stay unset",
);

const display = getTransactionDisplay(
  paid.transactions.find((row) => row.id === "pay-mortgage")!,
  paid.accounts,
  paid.categories,
  chequing.id,
);
assert(
  display.categoryLabel === "Mortgage",
  "The register shows the envelope on a categorized loan payment",
);

const normalized = normalizeBudgetPlan(paid);
const kept = normalized.transactions.find((row) => row.id === "pay-mortgage");
assert(
  kept?.categoryId === "mortgage-cat",
  "Normalize keeps the category on a transfer to an off-budget loan",
);
const stripped = normalizeBudgetPlan(
  makePlan({
    transactions: [
      tx({
        id: "between-budget",
        date: "2026-01-04",
        amount: 40,
        type: "transfer",
        accountId: chequing.id,
        transferAccountId: "acct-savings",
        categoryId: "groceries",
      }),
    ],
    accounts: [
      chequing,
      {
        id: "acct-savings",
        name: "Savings",
        type: "savings",
        onBudget: true,
        sortOrder: 4,
      },
    ],
  }),
);
assert(
  stripped.transactions[0]?.categoryId == null,
  "Normalize drops a category on a transfer that stays on-budget",
);

const legacyLoc = normalizeBudgetPlan(
  makePlan({
    accounts: [
      {
        id: "acct-loc",
        name: "Line",
        type: "line-of-credit",
        sortOrder: 0,
      } as BudgetAccount,
    ],
    transactions: [],
  }),
);
assert(
  legacyLoc.accounts[0]?.onBudget === true,
  "An existing line of credit with no on-budget flag stays on-budget",
);

const keptRates = normalizeBudgetPlan(
  makePlan({
    accounts: [autoLoan],
    transactions: [],
  }),
);
assert(
  keptRates.accounts[0]?.interestRates?.length === 2 &&
    keptRates.accounts[0]?.interestRates?.[0]?.annualPercent === 6.5,
  "Normalize keeps both saved rates",
);

const scheduled = materializeDueSchedules(
  makePlan({
    transactions: [
      tx({
        id: "income",
        date: "2026-01-02",
        amount: 3000,
        type: "inflow",
      }),
    ],
    monthBudgets: { "2026-01": { assignments: { "mortgage-cat": 900 } } },
    scheduledTransactions: [
      {
        id: "sched-mortgage",
        nextDate: "2026-01-15",
        frequency: "monthly",
        payee: "Transfer to House mortgage",
        accountId: chequing.id,
        transferAccountId: mortgage.id,
        categoryId: "mortgage-cat",
        amount: 900,
        type: "transfer",
        active: true,
      },
    ],
  }),
  "2026-01-15",
);
const posted = scheduled.transactions.find((row) => row.scheduledTransactionId === "sched-mortgage");
assert(
  posted?.categoryId === "mortgage-cat" && posted.type === "transfer",
  "A scheduled loan payment posts with its envelope",
);
assert(
  getReadyToAssign(scheduled, "2026-01") === 2100 &&
    getCategoryAvailable(scheduled, "mortgage-cat", "2026-01") === 0,
  "The posted payment spends the envelope and leaves Ready to Assign at 3000 − 900",
);

const brokerStripped = normalizeBudgetPlan(brokeragePay);
assert(
  brokerStripped.transactions.find((row) => row.id === "to-broker")?.categoryId == null,
  "Normalize drops a category on a transfer to an off-budget investment account",
);

const termsPlan = applyLoanTermsToPlan(
  makePlan({
    accounts: [{ ...autoLoan, interestRates: undefined, minimumPayment: undefined }],
    transactions: [],
  }),
  autoLoan.id,
  {
    interestRates: [
      { effectiveDate: "2026-01-01", annualPercent: 6.5 },
      { effectiveDate: "2026-06-01", annualPercent: 4.9 },
    ],
    minimumPayment: 400,
    paymentDueDay: 12,
    openingBalance: { amount: 11600, date: "2026-01-01" },
  },
);
const termsAccount = termsPlan.accounts.find((account) => account.id === autoLoan.id);
const termsOpening = termsPlan.transactions.find(
  (row) => row.payee === STARTING_BALANCE_PAYEE,
);
assert(
  termsAccount?.minimumPayment === 400 &&
    termsAccount.paymentDueDay === 12 &&
    termsAccount.openingBalance === 11600 &&
    termsAccount.interestRates?.length === 2 &&
    termsOpening?.amount === 11600 &&
    termsOpening.type === "outflow" &&
    termsOpening.memo === "Balance when the account was added",
  "applyLoanTermsToPlan stores terms and adds a Starting Balance outflow",
);

const blanked = syncOpeningBalanceTransaction(
  termsPlan.transactions,
  autoLoan,
  null,
);
const blankedRow = blanked.find((row) => row.payee === STARTING_BALANCE_PAYEE);
assert(
  blankedRow?.id === termsOpening?.id &&
    blankedRow?.amount === 11600 &&
    blankedRow?.memo === termsOpening?.memo,
  "Clearing the opening balance field does not delete the Starting Balance row",
);

const reconciledSource = termsPlan.transactions.map((row) =>
  row.payee === STARTING_BALANCE_PAYEE
    ? { ...row, cleared: "reconciled" as const, memo: "Matched the statement" }
    : row,
);
const reconciledPlan = applyLoanTermsToPlan(
  { ...termsPlan, transactions: reconciledSource },
  autoLoan.id,
  {
    interestRates: [{ effectiveDate: "2026-01-01", annualPercent: 3 }],
    minimumPayment: 400,
    paymentDueDay: 12,
    openingBalance: { amount: 500, date: "2026-03-01" },
  },
);
const reconciledRow = reconciledPlan.transactions.find(
  (row) => row.payee === STARTING_BALANCE_PAYEE,
);
const reconciledAccount = reconciledPlan.accounts.find(
  (account) => account.id === autoLoan.id,
);
assert(
  reconciledRow?.amount === 11600 &&
    reconciledRow.date === "2026-01-01" &&
    reconciledRow.memo === "Matched the statement" &&
    reconciledRow.cleared === "reconciled" &&
    reconciledAccount?.openingBalance === 11600 &&
    reconciledAccount.openingBalanceDate === "2026-01-01" &&
    reconciledAccount.interestRates?.[0]?.annualPercent === 3,
  "A reconciled Starting Balance row and its memo are left alone",
);

const memoEdit = {
  ...paid,
  transactions: paid.transactions.map((row) =>
    row.id === "pay-mortgage" ? { ...row, memo: "March extra", date: "2026-01-16" } : row,
  ),
};
assert(
  envelopeRequiredForTransfer({
    needsCategory: true,
    isNew: false,
    amountChanged: false,
    accountsChanged: false,
  }) === false,
  "A memo or date edit does not require an envelope",
);
assert(
  getReadyToAssign(memoEdit, "2026-01") === 8500 &&
    getCategoryAvailable(memoEdit, "mortgage-cat", "2026-01") === 0 &&
    getAccountBalance(mortgage, memoEdit.transactions) === 198500 &&
    memoEdit.transactions.find((row) => row.id === "pay-mortgage")?.categoryId ===
      "mortgage-cat",
  "Editing the memo and date keeps the categorized loan payment",
);

const amountEdit = {
  ...paid,
  transactions: paid.transactions.map((row) =>
    row.id === "pay-mortgage" ? { ...row, amount: 1000 } : row,
  ),
};
assert(
  envelopeRequiredForTransfer({
    needsCategory: true,
    isNew: false,
    amountChanged: true,
    accountsChanged: false,
  }) === true &&
    envelopeRequiredForTransfer({
      needsCategory: true,
      isNew: true,
      amountChanged: false,
      accountsChanged: false,
    }) === true &&
    envelopeRequiredForTransfer({
      needsCategory: false,
      isNew: true,
      amountChanged: true,
      accountsChanged: true,
    }) === false,
  "An envelope is required for a new liability transfer or an amount or account change",
);
assert(
  getCategoryAvailable(amountEdit, "mortgage-cat", "2026-01") === 500 &&
    getAccountBalance(chequing, amountEdit.transactions) === 9000 &&
    getAccountBalance(mortgage, amountEdit.transactions) === 199000 &&
    getReadyToAssign(amountEdit, "2026-01") === 8500,
  "Editing the payment amount updates the envelope and both balances",
);

const deleted = {
  ...paid,
  transactions: paid.transactions.filter((row) => row.id !== "pay-mortgage"),
};
assert(
  getCategoryAvailable(deleted, "mortgage-cat", "2026-01") === 1500 &&
    getAccountBalance(chequing, deleted.transactions) === 10000 &&
    getAccountBalance(mortgage, deleted.transactions) === 200000 &&
    getReadyToAssign(deleted, "2026-01") === 8500,
  "Deleting the categorized payment restores the envelope and both balances",
);

const trackedMortgage = applyAccountEdits(paid, mortgage.id, { onBudget: true });
assert(
  getCategoryAvailable(trackedMortgage, "mortgage-cat", "2026-01") === 1500 &&
    getReadyToAssign(trackedMortgage, "2026-01") === 8500 &&
    getAccountBalance(mortgage, trackedMortgage.transactions) === 198500,
  "Moving the mortgage on-budget stops the payment from spending the envelope",
);
const trackingAgain = applyAccountEdits(trackedMortgage, mortgage.id, {
  onBudget: false,
});
assert(
  trackingAgain.accounts.find((account) => account.id === mortgage.id)?.onBudget ===
    false &&
    getCategoryAvailable(trackingAgain, "mortgage-cat", "2026-01") === 0,
  "Moving the mortgage back to tracking spends the envelope again",
);

const locOff: BudgetAccount = {
  id: "acct-loc",
  name: "Line",
  type: "line-of-credit",
  onBudget: false,
  sortOrder: 5,
  interestRates: [{ effectiveDate: "2026-01-01", annualPercent: 9 }],
  minimumPayment: 50,
};
const locOn = ensureCreditCardPaymentCategories(
  applyAccountEdits(makePlan({ accounts: [chequing, locOff] }), locOff.id, {
    onBudget: true,
  }),
);
assert(
  paymentCategoryForAccount(locOn.categories, locOff.id) != null,
  "An on-budget line of credit gets a payment envelope",
);
const locBack = ensureCreditCardPaymentCategories(
  applyAccountEdits(locOn, locOff.id, { onBudget: false }),
);
assert(
  paymentCategoryForAccount(locBack.categories, locOff.id) == null,
  "A tracking line of credit does not keep a payment envelope",
);

const typedAway = applyAccountEdits(
  makePlan({
    accounts: [autoLoan],
    transactions: [
      tx({
        id: "auto-open",
        date: "2026-01-01",
        amount: 11600,
        type: "outflow",
        accountId: autoLoan.id,
        payee: STARTING_BALANCE_PAYEE,
        memo: "Balance when the account was added",
      }),
    ],
  }),
  autoLoan.id,
  { type: "brokerage", onBudget: false },
);
const typedAccount = typedAway.accounts.find((account) => account.id === autoLoan.id);
assert(
  typedAccount?.type === "brokerage" &&
    typedAccount.interestRates == null &&
    typedAccount.minimumPayment == null &&
    typedAccount.paymentDueDay == null &&
    typedAccount.openingBalance == null &&
    typedAccount.openingBalanceDate == null &&
    typedAway.transactions.some(
      (row) => row.payee === STARTING_BALANCE_PAYEE && row.amount === 11600,
    ),
  "Changing away from a loan drops loan-only fields and keeps the Starting Balance row",
);

const card: BudgetAccount = {
  id: "acct-card",
  name: "Visa",
  type: "credit-card",
  onBudget: true,
  sortOrder: 6,
};
const cardPlan = ensureCreditCardPaymentCategories(
  makePlan({
    accounts: [chequing, card, autoLoan],
    transactions: [
      tx({
        id: "income",
        date: "2026-01-02",
        amount: 1000,
        type: "inflow",
        accountId: chequing.id,
      }),
      tx({
        id: "card-to-loan",
        date: "2026-01-18",
        amount: 200,
        type: "transfer",
        accountId: card.id,
        transferAccountId: autoLoan.id,
        categoryId: "groceries",
        payee: "Transfer to Car loan",
      }),
    ],
    monthBudgets: { "2026-01": { assignments: { groceries: 200 } } },
  }),
);
const cardPayment = paymentCategoryForAccount(cardPlan.categories, card.id);
assert(
  transferLeavesBudget(card, autoLoan) === true &&
    getReadyToAssign(cardPlan, "2026-01") === 800 &&
    getCategoryAvailable(cardPlan, "groceries", "2026-01") === 0 &&
    cardPayment != null &&
    getCategoryAvailable(cardPlan, cardPayment.id, "2026-01") === 200 &&
    getAccountBalance(card, cardPlan.transactions) === 200 &&
    getAccountBalance(autoLoan, cardPlan.transactions) === -200,
  "A categorized card payment to an off-budget loan spends the envelope, funds the card payment envelope, and lowers the loan",
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("loan tests passed");
