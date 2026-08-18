/**
 * Daily-use YNAB parity: cover/rollover, move from Available, auto-assign,
 * import match, and cleared triad migration.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-daily-use-unit.mts
 */
import { applyAutoAssignUnderfunded, listUnderfundedAutoAssignTargets } from "../src/lib/budget/auto-assign.ts";
import {
  buildCategoryRows,
  getCategoryAvailable,
  getReadyToAssign,
} from "../src/lib/budget/calculations.ts";
import { normalizeClearedState } from "../src/lib/budget/cleared.ts";
import {
  findImportMatch,
  parseBudgetCsv,
  parsedCsvToTransactionInput,
} from "../src/lib/budget/csv.ts";
import { formatBudgetMoney, resolveBudgetCurrency } from "../src/lib/budget/format.ts";
import { normalizeBudgetPlan } from "../src/lib/budget/migrate-plan.ts";
import { applyCoverOverspend, applyMoveMoney } from "../src/lib/budget/move-money.ts";
import { derivePayees } from "../src/lib/budget/payees.ts";
import { READY_TO_ASSIGN_ID, type BudgetAccount, type BudgetPlan, type BudgetTransaction } from "../src/types/budget.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

const chequing: BudgetAccount = {
  id: "acct-chequing",
  name: "Chequing",
  type: "chequing",
  onBudget: true,
  sortOrder: 0,
};
const creditCard: BudgetAccount = {
  id: "acct-cc",
  name: "Visa",
  type: "credit-card",
  onBudget: true,
  sortOrder: 1,
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
    ...partial,
  };
}

function makePlan(overrides: Partial<BudgetPlan> = {}): BudgetPlan {
  return {
    id: "plan-1",
    name: "Plan",
    accounts: [chequing],
    categoryGroups: [{ id: "g1", name: "Living", sortOrder: 0 }],
    categories: [
      { id: "groceries", groupId: "g1", name: "Groceries", sortOrder: 0 },
      { id: "dining", groupId: "g1", name: "Dining Out", sortOrder: 1 },
    ],
    transactions: [],
    scheduledTransactions: [],
    monthBudgets: {},
    goals: [],
    currency: "USD",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const cashOverspend = makePlan({
  transactions: [
    tx({ id: "in-jan", date: "2026-01-02", amount: 200, type: "inflow" }),
    tx({
      id: "out-jan",
      date: "2026-01-18",
      amount: 150,
      type: "outflow",
      categoryId: "groceries",
      accountId: chequing.id,
    }),
  ],
  monthBudgets: { "2026-01": { assignments: { groceries: 100 } } },
});

assert(
  getCategoryAvailable(cashOverspend, "groceries", "2026-01") === -50,
  "Cash overspend is red in the open month (−50)",
);
assert(
  getReadyToAssign(cashOverspend, "2026-01") === 100,
  "Open-month cash overspend does not steal this month’s RTA",
);
assert(
  getCategoryAvailable(cashOverspend, "groceries", "2026-02") === 0,
  "Uncovered cash overspend is absorbed — next month Available is $0",
);
assert(
  getReadyToAssign(cashOverspend, "2026-02") === 50,
  "Uncovered cash overspend reduces next-month RTA (100 leftover − 50)",
);

const coveredCash = applyCoverOverspend(
  cashOverspend,
  "2026-01",
  "groceries",
  { type: "rta" },
  50,
);
assert(
  getCategoryAvailable(coveredCash, "groceries", "2026-01") === 0,
  "Cover from RTA brings January Available back to $0",
);
assert(
  getReadyToAssign(coveredCash, "2026-01") === 50,
  "Cover from RTA spends Ready to Assign this month",
);
assert(
  getReadyToAssign(coveredCash, "2026-02") === 50,
  "Covered cash overspend does not steal next-month RTA",
);

const coveredFromCategory = applyCoverOverspend(
  {
    ...cashOverspend,
    monthBudgets: {
      "2026-01": { assignments: { groceries: 100, dining: 80 } },
    },
    transactions: [
      ...cashOverspend.transactions,
      tx({ id: "in-extra", date: "2026-01-03", amount: 80, type: "inflow" }),
    ],
  },
  "2026-01",
  "groceries",
  { type: "category", categoryId: "dining" },
  50,
);
assert(
  getCategoryAvailable(coveredFromCategory, "groceries", "2026-01") === 0,
  "Cover from another category’s Available fills the cash hole",
);
assert(
  getCategoryAvailable(coveredFromCategory, "dining", "2026-01") === 30,
  "Cover subtracts from the source category’s Available (80 − 50)",
);

const cardPlan = normalizeBudgetPlan(
  makePlan({
    accounts: [chequing, creditCard],
    transactions: [
      tx({ id: "in-jan", date: "2026-01-02", amount: 400, type: "inflow" }),
      tx({
        id: "cc-charge",
        date: "2026-01-10",
        amount: 150,
        type: "outflow",
        accountId: creditCard.id,
        categoryId: "groceries",
        payee: "Store",
      }),
    ],
    monthBudgets: { "2026-01": { assignments: { groceries: 100 } } },
  }),
);
const paymentCat = cardPlan.categories.find(
  (category) => category.creditCardAccountId === creditCard.id,
);
assert(Boolean(paymentCat), "Credit card still gets a payment category");
assert(
  getCategoryAvailable(cardPlan, "groceries", "2026-01") === -50,
  "Credit overspend stays in the spending category (−50)",
);
assert(
  getReadyToAssign(cardPlan, "2026-02") === getReadyToAssign(cardPlan, "2026-01"),
  "Credit overspend does not reduce next-month Ready to Assign",
);
assert(
  getCategoryAvailable(cardPlan, "groceries", "2026-02") === -50,
  "Credit overspend carries into the next month (does not absorb)",
);
assert(
  paymentCat != null &&
    getCategoryAvailable(cardPlan, paymentCat.id, "2026-01") === 100,
  "Credit overspend underfunds the payment category (150 charge − 50 unfunded = 100 funded)",
);
const creditRow = buildCategoryRows(cardPlan, "2026-01")
  .flatMap((entry) => entry.categories)
  .find((row) => row.category.id === "groceries");
assert(
  creditRow?.status === "credit-overspent" && creditRow.overspendKind === "credit",
  "Credit overspend is visually distinct from cash (orange / credit-overspent)",
);
const cashRow = buildCategoryRows(cashOverspend, "2026-01")
  .flatMap((entry) => entry.categories)
  .find((row) => row.category.id === "groceries");
assert(
  cashRow?.status === "overspent" && cashRow.overspendKind === "cash",
  "Cash overspend stays red / overspent",
);

const leftoverMove = makePlan({
  transactions: [
    tx({ id: "in-jan", date: "2026-01-02", amount: 500, type: "inflow" }),
  ],
  monthBudgets: { "2026-01": { assignments: { dining: 200 } } },
});
assert(
  getCategoryAvailable(leftoverMove, "dining", "2026-02") === 200,
  "January leftover is still Available in February",
);
const movedLeftover = applyMoveMoney(
  leftoverMove,
  "2026-02",
  "dining",
  "groceries",
  75,
);
assert(
  getCategoryAvailable(movedLeftover, "dining", "2026-02") === 125,
  "Move uses leftover Available, not this-month Assigned (200 − 75)",
);
assert(
  getCategoryAvailable(movedLeftover, "groceries", "2026-02") === 75,
  "Leftover Available arrived in Groceries",
);
assert(
  (movedLeftover.monthBudgets["2026-02"]?.assignments.dining ?? 0) === -75,
  "Moving leftover records a negative this-month assignment on the source",
);
const movedToRta = applyMoveMoney(
  leftoverMove,
  "2026-02",
  "dining",
  READY_TO_ASSIGN_ID,
  50,
);
assert(
  getCategoryAvailable(movedToRta, "dining", "2026-02") === 150,
  "Move to RTA reduces source Available",
);
assert(
  getReadyToAssign(movedToRta, "2026-02") ===
    getReadyToAssign(leftoverMove, "2026-02") + 50,
  "Move to RTA returns leftover to Ready to Assign",
);

const underfundedPlan = makePlan({
  transactions: [
    tx({ id: "in-jan", date: "2026-01-02", amount: 100, type: "inflow" }),
  ],
  goals: [
    {
      id: "goal-dining",
      categoryId: "dining",
      type: "monthly-funding",
      targetAmount: 40,
    },
    {
      id: "goal-groc",
      categoryId: "groceries",
      type: "monthly-funding",
      targetAmount: 80,
    },
  ],
});
const targets = listUnderfundedAutoAssignTargets(underfundedPlan, "2026-01");
assert(
  targets.length === 2 &&
    targets[0]?.categoryId === "groceries" &&
    targets[1]?.categoryId === "dining",
  "Auto-Assign order is stable: category sortOrder (Groceries then Dining Out)",
);
const assigned = applyAutoAssignUnderfunded(underfundedPlan, "2026-01");
assert(
  assigned.monthBudgets["2026-01"]?.assignments.groceries === 80 &&
    assigned.monthBudgets["2026-01"]?.assignments.dining === 20,
  "Auto-Assign funds Groceries fully, then Dining until RTA hits 0 (80 + 20)",
);
assert(
  getReadyToAssign(assigned, "2026-01") === 0,
  "Auto-Assign stops when Ready to Assign hits 0",
);

const payees = derivePayees([
  tx({
    id: "p1",
    date: "2026-01-04",
    amount: 10,
    type: "outflow",
    payee: "Whole Foods",
    categoryId: "groceries",
  }),
  tx({
    id: "p2",
    date: "2026-01-12",
    amount: 12,
    type: "outflow",
    payee: "Whole Foods",
    categoryId: "dining",
  }),
  tx({
    id: "xfer",
    date: "2026-01-13",
    amount: 20,
    type: "transfer",
    payee: "Transfer to Visa",
    transferAccountId: creditCard.id,
  }),
]);
assert(
  payees.length === 1 &&
    payees[0]?.name === "Whole Foods" &&
    payees[0]?.lastCategoryId === "dining",
  "Derived payees keep last-used category and omit transfer payees",
);

const existingEntered: BudgetTransaction[] = [
  tx({
    id: "manual-1",
    date: "2026-03-02",
    amount: 84,
    type: "outflow",
    payee: "Groceries",
    categoryId: "groceries",
    cleared: "uncleared",
  }),
];
const matchPreview = parseBudgetCsv(
  `Date,Description,Amount
2026-03-04,Whole Foods,-84
`,
  {
    accounts: [chequing],
    categories: [
      { id: "groceries", name: "Groceries" },
      { id: "dining", name: "Dining Out" },
    ],
    existingTransactions: existingEntered,
    fallbackAccountId: chequing.id,
  },
);
assert(
  matchPreview.imported.length === 0 &&
    matchPreview.matched.length === 1 &&
    matchPreview.matched[0]?.matchedTransactionId === "manual-1",
  "Import matches an existing entered txn (same amount, close dates) instead of adding a row",
);
assert(
  findImportMatch(
    { date: "2026-03-04", amount: 84, accountId: chequing.id, type: "outflow" },
    existingEntered,
    new Set(),
  ) === "manual-1",
  "Match helper links the entered row by amount + account + close date",
);

const exactDup = parseBudgetCsv(
  `Date,Description,Amount
2026-03-02,Groceries,-84
`,
  {
    accounts: [chequing],
    categories: [{ id: "groceries", name: "Groceries" }],
    existingTransactions: existingEntered,
    fallbackAccountId: chequing.id,
  },
);
assert(
  exactDup.duplicates.length === 1 && exactDup.imported.length === 0,
  "Exact date + payee + amount + account is still skipped as a duplicate",
);

const newImport = parseBudgetCsv(
  `Date,Description,Amount
2026-03-10,New Cafe,-12
`,
  {
    accounts: [chequing],
    categories: [{ id: "dining", name: "Dining Out" }],
    existingTransactions: existingEntered,
    fallbackAccountId: chequing.id,
  },
);
const importedInput = parsedCsvToTransactionInput(newImport.imported[0]!);
assert(
  importedInput.approved === false && Boolean(importedInput.importId),
  "New imported rows land unapproved with an import_id",
);

const legacyCleared = normalizeBudgetPlan({
  ...makePlan({
    transactions: [
      {
        id: "old-true",
        date: "2026-01-02",
        payee: "Pay",
        accountId: chequing.id,
        categoryId: null,
        amount: 10,
        type: "inflow",
        cleared: true,
      } as unknown as BudgetTransaction,
      {
        id: "old-false",
        date: "2026-01-03",
        payee: "Store",
        accountId: chequing.id,
        categoryId: "groceries",
        amount: 4,
        type: "outflow",
        cleared: false,
      } as unknown as BudgetTransaction,
    ],
  }),
});
assert(
  legacyCleared.transactions[0]?.cleared === "cleared" &&
    legacyCleared.transactions[1]?.cleared === "uncleared" &&
    legacyCleared.transactions.every((row) => row.cleared !== "reconciled"),
  "Legacy cleared true/false migrates to cleared/uncleared — no invented reconciled history",
);
assert(
  normalizeClearedState(true) === "cleared" &&
    normalizeClearedState(false) === "uncleared" &&
    normalizeClearedState("reconciled") === "reconciled",
  "normalizeClearedState maps booleans and keeps an explicit triad value",
);
assert(
  legacyCleared.currency === "USD",
  "Plans without a currency default to USD",
);
assert(
  formatBudgetMoney(12.5, "USD").includes("12.50") &&
    resolveBudgetCurrency(undefined) === "USD" &&
    resolveBudgetCurrency("CAD") === "CAD",
  "Budget money shows cents and accepts USD or CAD",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall budget daily-use unit checks passed");
