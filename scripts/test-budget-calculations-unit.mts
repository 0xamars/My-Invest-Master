/**
 * Budget Ready to Assign + category available month carry (YNAB-style).
 * Also covers transfers and split outflows.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-calculations-unit.mts
 */
import { removeAccountFromBudget } from "../src/lib/budget/account-mutations.ts";
import {
  getAccountBalance,
  getTransactionBalanceEffect,
} from "../src/lib/budget/accounts.ts";
import {
  buildCategoryRows,
  computeMonthSummary,
  getCategoryActivity,
  getCategoryAvailable,
  getMonthAssignments,
  getReadyToAssign,
  getTransactionsForMonth,
} from "../src/lib/budget/calculations.ts";
import { removeCategoryFromBudget } from "../src/lib/budget/category-mutations.ts";
import { normalizeBudgetPlan } from "../src/lib/budget/migrate-plan.ts";
import { getSpendingByCategory } from "../src/lib/budget/reports.ts";
import { isIncomeTransaction } from "../src/lib/budget/transactions.ts";
import {
  shiftMonthKey,
  type BudgetAccount,
  type BudgetData,
  type BudgetPlan,
  type BudgetTransaction,
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

function tx(
  partial: Pick<BudgetTransaction, "id" | "date" | "amount" | "type"> &
    Partial<BudgetTransaction>,
): BudgetTransaction {
  return {
    payee: partial.payee ?? "Payee",
    accountId: partial.accountId ?? "acct-1",
    categoryId: partial.categoryId ?? null,
    cleared: partial.cleared ?? true,
    ...partial,
  };
}

function makeBudget(overrides: Partial<BudgetData> = {}): BudgetData {
  return {
    categoryGroups: [{ id: "g1", name: "Living", sortOrder: 0 }],
    categories: [
      { id: "groceries", groupId: "g1", name: "Groceries", sortOrder: 0 },
      { id: "rent", groupId: "g1", name: "Rent", sortOrder: 1 },
    ],
    transactions: [],
    monthBudgets: {},
    goals: [],
    updatedAt: "2026-01-15T00:00:00.000Z",
    ...overrides,
  };
}

function leftoverReadyToAssign(budget: BudgetData, monthKey: string): number {
  const months = new Set<string>();
  for (const transaction of budget.transactions) {
    months.add(transaction.date.slice(0, 7));
  }
  for (const key of Object.keys(budget.monthBudgets)) {
    months.add(key);
  }
  if (months.size === 0 || monthKey < [...months].sort()[0]) return 0;

  let ready = 0;
  let cursor = [...months].sort()[0];
  while (cursor <= monthKey) {
    const monthTransactions = getTransactionsForMonth(budget.transactions, cursor);
    const income = monthTransactions
      .filter(isIncomeTransaction)
      .reduce((sum, row) => sum + row.amount, 0);
    const assigned = Object.values(getMonthAssignments(budget, cursor)).reduce(
      (sum, value) => sum + value,
      0,
    );
    ready = ready + income - assigned;
    if (cursor === monthKey) break;
    cursor = shiftMonthKey(cursor, 1);
  }
  return ready;
}

const januaryBudget = makeBudget({
  transactions: [
    tx({ id: "in-jan", date: "2026-01-02", amount: 1000, type: "inflow", payee: "Pay" }),
  ],
  monthBudgets: {
    "2026-01": { assignments: { groceries: 400 } },
  },
});

const jan = computeMonthSummary(januaryBudget, "2026-01");
assert(jan.totalIncome === 1000, "January income is this month only");
assert(jan.totalAssigned === 400, "January assigned is this month only");
assert(jan.readyToAssign === 600, "January RTA = 1000 income − 400 assigned");
assert(jan.availableToBudget === 600, "Available to Budget aliases Ready to Assign");
assert(
  getCategoryAvailable(januaryBudget, "groceries", "2026-01") === 400,
  "January Groceries available = 400 assigned − 0 activity",
);

const feb = computeMonthSummary(januaryBudget, "2026-02");
assert(feb.totalIncome === 0, "February income stays 0 when nothing is recorded");
assert(feb.totalAssigned === 0, "February assigned stays 0 when user assigns $0");
assert(feb.readyToAssign === 600, "February RTA carries leftover January Ready to Assign");
assert(
  getCategoryAvailable(januaryBudget, "groceries", "2026-02") === 400,
  "Groceries funded in January with no spend is still available in February",
);

const janRows = buildCategoryRows(januaryBudget, "2026-02");
const groceriesFeb = janRows[0].categories.find((row) => row.category.id === "groceries");
assert(groceriesFeb?.assigned === 0, "February Assigned column stays this-month ($0)");
assert(groceriesFeb?.activity === 0, "February Activity column stays this-month ($0)");
assert(groceriesFeb?.available === 400, "February Available includes leftover assigned-but-unspent");

const withFebIncome = makeBudget({
  transactions: [
    tx({ id: "in-jan", date: "2026-01-02", amount: 1000, type: "inflow" }),
    tx({ id: "in-feb", date: "2026-02-01", amount: 500, type: "inflow" }),
    tx({
      id: "out-jan",
      date: "2026-01-20",
      amount: 80,
      type: "outflow",
      categoryId: "groceries",
    }),
  ],
  monthBudgets: {
    "2026-01": { assignments: { groceries: 400 } },
    "2026-02": { assignments: { rent: 200 } },
  },
});

assert(
  computeMonthSummary(withFebIncome, "2026-01").readyToAssign === 600,
  "Future February income does not change January RTA",
);
assert(
  computeMonthSummary(withFebIncome, "2026-02").readyToAssign === 900,
  "February RTA = 600 leftover + 500 income − 200 assigned",
);
assert(
  getCategoryAvailable(withFebIncome, "groceries", "2026-02") === 320,
  "Available = prior 320 leftover + 0 Feb assigned − 0 Feb activity",
);
assert(
  getCategoryAvailable(withFebIncome, "groceries", "2026-01") === 320,
  "January Groceries available = 400 assigned − 80 activity",
);

const gapBudget = makeBudget({
  transactions: [
    tx({ id: "in-jan", date: "2026-01-02", amount: 1000, type: "inflow" }),
  ],
  monthBudgets: {
    "2026-01": { assignments: { groceries: 250 } },
  },
});
assert(
  computeMonthSummary(gapBudget, "2026-03").readyToAssign === 750,
  "Leftover RTA carries across a month with no transactions or assignments",
);
assert(
  getCategoryAvailable(gapBudget, "groceries", "2026-03") === 250,
  "Category leftover carries across a quiet February into March",
);

const overspent = makeBudget({
  transactions: [
    tx({ id: "in-jan", date: "2026-01-02", amount: 200, type: "inflow" }),
    tx({
      id: "out-jan",
      date: "2026-01-18",
      amount: 150,
      type: "outflow",
      categoryId: "groceries",
    }),
  ],
  monthBudgets: {
    "2026-01": { assignments: { groceries: 100 } },
  },
});
assert(
  getCategoryAvailable(overspent, "groceries", "2026-02") === -50,
  "Overspend carries as negative available (prior available + assigned − activity)",
);
assert(
  computeMonthSummary(overspent, "2026-02").readyToAssign === 100,
  "RTA is inflows through month minus assignments, not reduced by overspend",
);

assert(
  leftoverReadyToAssign(withFebIncome, "2026-02") ===
    getReadyToAssign(withFebIncome, "2026-02"),
  "Leftover walk matches cumulative inflows − assignments",
);
assert(
  leftoverReadyToAssign(gapBudget, "2026-03") === getReadyToAssign(gapBudget, "2026-03"),
  "Leftover walk matches cumulative form across a gap month",
);
assert(
  leftoverReadyToAssign(januaryBudget, "2025-12") === 0 &&
    getReadyToAssign(januaryBudget, "2025-12") === 0,
  "Months before the first inflow/assignment have $0 Ready to Assign",
);

const chequing: BudgetAccount = {
  id: "acct-chequing",
  name: "Chequing",
  type: "chequing",
  sortOrder: 0,
};
const savings: BudgetAccount = {
  id: "acct-savings",
  name: "Savings",
  type: "savings",
  sortOrder: 1,
};
const creditCard: BudgetAccount = {
  id: "acct-cc",
  name: "Visa",
  type: "credit-card",
  sortOrder: 2,
};

const transferBudget = makeBudget({
  accounts: [chequing, savings, creditCard],
  transactions: [
    tx({
      id: "in-jan",
      date: "2026-01-02",
      amount: 1000,
      type: "inflow",
      accountId: chequing.id,
    }),
    tx({
      id: "cc-charge",
      date: "2026-01-08",
      amount: 200,
      type: "outflow",
      accountId: creditCard.id,
      categoryId: null,
      payee: "Store",
    }),
    tx({
      id: "xfer-savings",
      date: "2026-01-10",
      amount: 300,
      type: "transfer",
      accountId: chequing.id,
      transferAccountId: savings.id,
      payee: "Transfer to Savings",
      categoryId: null,
    }),
    tx({
      id: "xfer-cc",
      date: "2026-01-12",
      amount: 150,
      type: "transfer",
      accountId: chequing.id,
      transferAccountId: creditCard.id,
      payee: "Transfer to Visa",
      categoryId: null,
    }),
  ],
  monthBudgets: {
    "2026-01": { assignments: { groceries: 400 } },
  },
});

const transferSummary = computeMonthSummary(transferBudget, "2026-01");
assert(
  transferSummary.totalIncome === 1000,
  "Transfer is not income",
);
assert(
  transferSummary.totalSpent === 200,
  "Transfer is not spending (only the card purchase counts)",
);
assert(
  transferSummary.readyToAssign === 600,
  "Transfer does not change Ready to Assign (1000 − 400 assigned)",
);
assert(
  getCategoryActivity(transferBudget.transactions, "groceries", "2026-01") === 0,
  "Transfer does not hit category activity",
);
assert(
  getCategoryAvailable(transferBudget, "groceries", "2026-01") === 400,
  "Transfer does not change category available",
);
assert(
  getAccountBalance(chequing, transferBudget.transactions) === 550,
  "Chequing falls by both transfers (1000 − 300 − 150)",
);
assert(
  getAccountBalance(savings, transferBudget.transactions) === 300,
  "Savings rises by the inbound transfer",
);
assert(
  getAccountBalance(creditCard, transferBudget.transactions) === 50,
  "Paying a credit card is a transfer that reduces the liability (200 charge − 150 payment)",
);
assert(
  getTransactionBalanceEffect(
    chequing,
    transferBudget.transactions.find((row) => row.id === "xfer-savings")!,
  ) === -300,
  "From-account transfer effect is an outflow",
);
assert(
  getTransactionBalanceEffect(
    savings,
    transferBudget.transactions.find((row) => row.id === "xfer-savings")!,
  ) === 300,
  "To-account transfer effect is an inflow",
);
assert(
  getSpendingByCategory(transferBudget, "2026-01").length === 0,
  "Reports do not treat transfers (or uncategorized card spend) as category spend",
);
assert(
  leftoverReadyToAssign(transferBudget, "2026-01") ===
    getReadyToAssign(transferBudget, "2026-01"),
  "Leftover walk still matches Ready to Assign when transfers are present",
);

const splitBudget = makeBudget({
  accounts: [chequing],
  transactions: [
    tx({
      id: "in-jan",
      date: "2026-01-02",
      amount: 1000,
      type: "inflow",
      accountId: chequing.id,
    }),
    tx({
      id: "split-store",
      date: "2026-01-15",
      amount: 80,
      type: "outflow",
      accountId: chequing.id,
      categoryId: null,
      payee: "Warehouse Club",
      splits: [
        { id: "s1", categoryId: "groceries", amount: 50 },
        { id: "s2", categoryId: "rent", amount: 30 },
      ],
    }),
  ],
  monthBudgets: {
    "2026-01": { assignments: { groceries: 400, rent: 200 } },
  },
});

assert(
  getCategoryActivity(splitBudget.transactions, "groceries", "2026-01") === 50,
  "Split activity hits Groceries for its line only",
);
assert(
  getCategoryActivity(splitBudget.transactions, "rent", "2026-01") === 30,
  "Split activity hits Rent for its line only",
);
assert(
  getCategoryAvailable(splitBudget, "groceries", "2026-01") === 350,
  "Groceries available uses the split line (400 − 50)",
);
assert(
  getCategoryAvailable(splitBudget, "rent", "2026-01") === 170,
  "Rent available uses the split line (200 − 30)",
);
assert(
  computeMonthSummary(splitBudget, "2026-01").totalSpent === 80,
  "Split outflow counts the parent amount once in this-month Activity/spent",
);
assert(
  computeMonthSummary(splitBudget, "2026-01").readyToAssign === 400,
  "Split outflow does not change Ready to Assign",
);
assert(
  getAccountBalance(chequing, splitBudget.transactions) === 920,
  "Split outflow moves the account by the parent amount",
);

const spendingRows = getSpendingByCategory(splitBudget, "2026-01");
assert(
  spendingRows.find((row) => row.categoryId === "groceries")?.amount === 50,
  "Spending report uses split lines, not the parent categoryId",
);
assert(
  spendingRows.find((row) => row.categoryId === "rent")?.amount === 30,
  "Spending report includes the second split category",
);

const legacyPlan = normalizeBudgetPlan({
  id: "legacy",
  name: "Legacy",
  accounts: [chequing],
  categoryGroups: [{ id: "g1", name: "Living", sortOrder: 0 }],
  categories: [{ id: "groceries", groupId: "g1", name: "Groceries", sortOrder: 0 }],
  transactions: [
    {
      id: "old-in",
      date: "2026-01-02",
      payee: "Pay",
      accountId: chequing.id,
      categoryId: null,
      amount: 500,
      type: "inflow",
      cleared: true,
    },
    {
      id: "old-out",
      date: "2026-01-04",
      payee: "Store",
      accountId: chequing.id,
      categoryId: "groceries",
      amount: 20,
      type: "outflow",
      cleared: false,
    },
  ],
  scheduledTransactions: [],
  monthBudgets: { "2026-01": { assignments: { groceries: 100 } } },
  goals: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as BudgetPlan);

assert(
  legacyPlan.transactions[0]?.transferAccountId === undefined &&
    legacyPlan.transactions[0]?.splits === undefined &&
    legacyPlan.transactions[0]?.categoryId === null,
  "Old inflows normalize without transfer/split fields and stay Ready to Assign",
);
assert(
  legacyPlan.transactions[1]?.categoryId === "groceries" &&
    legacyPlan.transactions[1]?.splits === undefined,
  "Old single-category outflows keep working after normalize",
);
assert(
  getReadyToAssign(legacyPlan, "2026-01") === 400,
  "Normalized legacy plan still computes Ready to Assign",
);

const afterCategoryDelete = removeCategoryFromBudget(splitBudget, "groceries");
assert(
  afterCategoryDelete.transactions[1]?.splits?.[0]?.categoryId === null &&
    afterCategoryDelete.transactions[1]?.splits?.[1]?.categoryId === "rent",
  "Deleting a category clears it on split lines and leaves the others",
);

const planWithTransfer: BudgetPlan = {
  id: "plan",
  name: "Plan",
  accounts: [chequing, savings],
  categoryGroups: [],
  categories: [],
  transactions: [
    tx({
      id: "xfer-savings",
      date: "2026-01-10",
      amount: 300,
      type: "transfer",
      accountId: chequing.id,
      transferAccountId: savings.id,
    }),
  ],
  scheduledTransactions: [],
  monthBudgets: {},
  goals: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const afterAccountDelete = removeAccountFromBudget(planWithTransfer, savings.id, {
  type: "delete-transactions",
});
assert(
  afterAccountDelete.transactions.length === 0,
  "Deleting an account removes transfers that touch it",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall budget calculation unit checks passed");
