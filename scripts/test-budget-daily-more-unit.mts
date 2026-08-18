/**
 * Daily Budget follow-ons: Reset Available, bulk register, reports,
 * scheduled enter-now + import match, and leftover-safe transfer notes.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-daily-more-unit.mts
 */
import {
  applyBulkApprove,
  applyBulkCategorize,
  applyBulkDelete,
  applyBulkToggleCleared,
} from "../src/lib/budget/bulk-transactions.ts";
import {
  getCategoryAvailable,
  getReadyToAssign,
} from "../src/lib/budget/calculations.ts";
import { findImportMatch, parseBudgetCsv } from "../src/lib/budget/csv.ts";
import { normalizeBudgetPlan } from "../src/lib/budget/migrate-plan.ts";
import { READY_TO_ASSIGN_ID, type BudgetAccount, type BudgetPlan, type BudgetTransaction } from "../src/types/budget.ts";
import {
  applyResetAvailable,
  previewResetAvailable,
} from "../src/lib/budget/reset-available.ts";
import {
  filterTransactions,
  getSpendingByCategoryInRange,
  getSpendingByPayee,
  resolveReportDateRange,
} from "../src/lib/budget/reports.ts";
import {
  enterScheduledNow,
  materializeDueSchedules,
} from "../src/lib/budget/scheduled.ts";

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

const leftoverPlan = makePlan({
  transactions: [
    tx({ id: "in-jan", date: "2026-01-02", amount: 400, type: "inflow" }),
    tx({
      id: "out-groc",
      date: "2026-01-18",
      amount: 150,
      type: "outflow",
      categoryId: "groceries",
    }),
  ],
  monthBudgets: { "2026-01": { assignments: { groceries: 100, dining: 200 } } },
});

assert(
  getCategoryAvailable(leftoverPlan, "dining", "2026-01") === 200,
  "Dining leftover Available is 200 before Reset",
);
assert(
  getCategoryAvailable(leftoverPlan, "groceries", "2026-01") === -50,
  "Groceries is overspent 50 before Reset",
);

const resetPreview = previewResetAvailable(leftoverPlan, "2026-01");
assert(
  resetPreview.leftover === 200 &&
    resetPreview.leftoverLines.length === 1 &&
    resetPreview.leftoverLines[0]?.categoryId === "dining" &&
    resetPreview.covered === 0,
  "Reset preview sweeps leftover Dining and does not include overspend",
);

const resetOnly = applyResetAvailable(leftoverPlan, "2026-01");
assert(
  getCategoryAvailable(resetOnly, "dining", "2026-01") === 0,
  "Reset Available returns leftover to RTA (Dining is 0)",
);
assert(
  getCategoryAvailable(resetOnly, "groceries", "2026-01") === -50,
  "Reset Available does not steal overspend",
);
assert(
  getReadyToAssign(resetOnly, "2026-01") ===
    getReadyToAssign(leftoverPlan, "2026-01") + 200,
  "Swept leftover lands in Ready to Assign (100 leftover RTA + 200)",
);

const resetWithCover = applyResetAvailable(leftoverPlan, "2026-01", {
  coverOverspend: true,
});
assert(
  getCategoryAvailable(resetWithCover, "groceries", "2026-01") === 0,
  "Reset with Cover fills the overspend from the swept RTA",
);
assert(
  getReadyToAssign(resetWithCover, "2026-01") ===
    getReadyToAssign(leftoverPlan, "2026-01") + 150,
  "Cover spends 50 of the 200 leftover after the sweep",
);

const cardPlan = normalizeBudgetPlan(
  makePlan({
    accounts: [chequing, creditCard],
    transactions: [
      tx({ id: "in-jan", date: "2026-01-02", amount: 300, type: "inflow" }),
    ],
    monthBudgets: { "2026-01": { assignments: { dining: 80 } } },
  }),
);
const paymentCat = cardPlan.categories.find(
  (category) => category.creditCardAccountId === creditCard.id,
);
const paymentAssigned = makePlan({
  ...cardPlan,
  monthBudgets: {
    "2026-01": {
      assignments: {
        dining: 80,
        ...(paymentCat ? { [paymentCat.id]: 40 } : {}),
      },
    },
  },
});
const resetSkipPayment = applyResetAvailable(paymentAssigned, "2026-01");
assert(
  paymentCat != null &&
    (resetSkipPayment.monthBudgets["2026-01"]?.assignments[paymentCat.id] ?? 0) ===
      40,
  "Reset Available skips credit-card payment categories",
);
assert(
  getCategoryAvailable(resetSkipPayment, "dining", "2026-01") === 0,
  "User leftover still sweeps when a payment category is present",
);

const inboxPlan = makePlan({
  transactions: [
    tx({
      id: "t1",
      date: "2026-03-02",
      amount: 12,
      type: "outflow",
      categoryId: null,
      approved: false,
      payee: "Cafe",
    }),
    tx({
      id: "t2",
      date: "2026-03-03",
      amount: 8,
      type: "outflow",
      categoryId: null,
      approved: false,
      payee: "Market",
    }),
    tx({
      id: "t3",
      date: "2026-03-04",
      amount: 20,
      type: "inflow",
      approved: false,
      payee: "Payroll",
    }),
  ],
});
const categorized = applyBulkCategorize(inboxPlan, ["t1", "t2", "t3"], "dining");
assert(
  categorized.transactions.find((row) => row.id === "t1")?.categoryId === "dining" &&
    categorized.transactions.find((row) => row.id === "t2")?.categoryId === "dining",
  "Bulk categorize sets Dining on selected outflows",
);
assert(
  categorized.transactions.find((row) => row.id === "t3")?.categoryId === null,
  "Bulk categorize does not invent a category on an inflow",
);

const approved = applyBulkApprove(inboxPlan, ["t1", "t2"]);
assert(
  approved.transactions.find((row) => row.id === "t1")?.approved === true &&
    approved.transactions.find((row) => row.id === "t2")?.approved === true &&
    approved.transactions.find((row) => row.id === "t3")?.approved === false,
  "Bulk approve marks only the selected inbox rows",
);

const deleted = applyBulkDelete(inboxPlan, ["t1"]);
assert(
  deleted.transactions.map((row) => row.id).join(",") === "t2,t3",
  "Bulk delete removes the selected row",
);

const clearedPlan = makePlan({
  transactions: [
    tx({
      id: "c1",
      date: "2026-03-01",
      amount: 5,
      type: "outflow",
      cleared: "uncleared",
    }),
    tx({
      id: "c2",
      date: "2026-03-02",
      amount: 5,
      type: "outflow",
      cleared: "reconciled",
    }),
  ],
});
const toggled = applyBulkToggleCleared(clearedPlan, ["c1", "c2"]);
assert(
  toggled.transactions.find((row) => row.id === "c1")?.cleared === "cleared" &&
    toggled.transactions.find((row) => row.id === "c2")?.cleared === "reconciled",
  "Bulk toggle cleared skips reconciled rows",
);

const reportPlan = makePlan({
  transactions: [
    tx({
      id: "g1",
      date: "2026-01-10",
      amount: 30,
      type: "outflow",
      categoryId: "groceries",
      payee: "Whole Foods",
    }),
    tx({
      id: "g2",
      date: "2026-02-10",
      amount: 20,
      type: "outflow",
      categoryId: "groceries",
      payee: "Whole Foods",
    }),
    tx({
      id: "d1",
      date: "2026-02-12",
      amount: 15,
      type: "outflow",
      categoryId: "dining",
      payee: "Cafe",
    }),
    tx({ id: "in1", date: "2026-02-01", amount: 100, type: "inflow" }),
  ],
});
const last3 = resolveReportDateRange("last-3-months", {
  now: new Date(2026, 2, 15),
});
assert(
  last3.fromDate === "2026-01-01" &&
    last3.toDate === "2026-03-31" &&
    last3.monthKeys.join(",") === "2026-01,2026-02,2026-03",
  "Last 3 months is January–March when today is mid-March",
);
const grocerySpend = getSpendingByCategoryInRange(
  reportPlan,
  last3.fromDate,
  last3.toDate,
);
assert(
  grocerySpend[0]?.categoryId === "groceries" && grocerySpend[0]?.amount === 50,
  "Spending by category sums Groceries across the selected range (30 + 20)",
);
const payeeSpend = getSpendingByPayee(reportPlan, last3.fromDate, last3.toDate);
assert(
  payeeSpend[0]?.payee === "Whole Foods" && payeeSpend[0]?.amount === 50,
  "Payee report sums spend by payee in the same range",
);
const drilled = filterTransactions(reportPlan, {
  categoryId: "groceries",
  fromDate: last3.fromDate,
  toDate: last3.toDate,
});
assert(
  drilled.length === 2 && drilled.every((row) => row.categoryId === "groceries"),
  "Category drill uses the same date-range filter as the spending report",
);

const scheduledPlan = makePlan({
  scheduledTransactions: [
    {
      id: "sched-rent",
      nextDate: "2026-09-01",
      frequency: "monthly",
      payee: "Landlord",
      accountId: chequing.id,
      categoryId: "groceries",
      amount: 120,
      type: "outflow",
    },
  ],
});
const beforeDue = materializeDueSchedules(scheduledPlan, "2026-08-18");
assert(beforeDue === scheduledPlan, "Upcoming scheduled rows still do not auto-post");
const entered = enterScheduledNow(scheduledPlan, "sched-rent");
assert(
  entered.transactions.length === 1 &&
    entered.transactions[0]?.scheduledTransactionId === "sched-rent" &&
    entered.transactions[0]?.date === "2026-09-01" &&
    entered.transactions[0]?.amount === 120,
  "Enter now posts the next scheduled occurrence immediately",
);
assert(
  entered.scheduledTransactions[0]?.nextDate === "2026-10-01",
  "Enter now advances the schedule to the following date",
);
const enteredAgain = enterScheduledNow(entered, "sched-rent");
assert(
  enteredAgain.transactions.length === 2 &&
    enteredAgain.scheduledTransactions[0]?.nextDate === "2026-11-01",
  "A second Enter now posts the new next date, not a duplicate of the first",
);

const scheduledMatch = parseBudgetCsv(
  `Date,Description,Amount
2026-09-03,Landlord,-120
`,
  {
    accounts: [chequing],
    categories: [
      { id: "groceries", name: "Groceries" },
      { id: "dining", name: "Dining Out" },
    ],
    existingTransactions: entered.transactions,
    fallbackAccountId: chequing.id,
  },
);
assert(
  scheduledMatch.imported.length === 0 &&
    scheduledMatch.matched.length === 1 &&
    scheduledMatch.matched[0]?.matchedTransactionId === entered.transactions[0]?.id,
  "Import matches an Enter-now scheduled post (amount + account + close dates)",
);
assert(
  findImportMatch(
    {
      date: "2026-09-03",
      amount: 120,
      accountId: chequing.id,
      type: "outflow",
    },
    entered.transactions,
    new Set(),
  ) === entered.transactions[0]?.id,
  "Match helper links the scheduled/posted row the same way as a manual row",
);

assert(READY_TO_ASSIGN_ID === "ready-to-assign", "RTA sentinel is unchanged");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall budget daily-more unit checks passed");
