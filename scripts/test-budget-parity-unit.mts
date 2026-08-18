/**
 * YNAB-parity Budget: scheduled materialize, credit-card payment vs transfer,
 * and Age of Money.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-parity-unit.mts
 */
import {
  computeAgeOfMoney,
  daysBetweenDateKeys,
} from "../src/lib/budget/age-of-money.ts";
import {
  getAccountBalance,
} from "../src/lib/budget/accounts.ts";
import {
  computeMonthSummary,
  getCategoryActivity,
  getCategoryAvailable,
  getReadyToAssign,
} from "../src/lib/budget/calculations.ts";
import {
  CREDIT_CARD_PAYMENTS_GROUP_NAME,
  ensureCreditCardPaymentCategories,
  paymentCategoryForAccount,
} from "../src/lib/budget/credit-card-payments.ts";
import { normalizeBudgetPlan } from "../src/lib/budget/migrate-plan.ts";
import { getSpendingByCategory } from "../src/lib/budget/reports.ts";
import {
  addMonthsToDateKey,
  getUpcomingScheduledInstances,
  materializeDueSchedules,
  nextScheduledDate,
} from "../src/lib/budget/scheduled.ts";
import type {
  BudgetAccount,
  BudgetPlan,
  BudgetScheduledTransaction,
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

const chequing: BudgetAccount = {
  id: "acct-chequing",
  name: "Chequing",
  type: "chequing",
  sortOrder: 0,
};
const creditCard: BudgetAccount = {
  id: "acct-cc",
  name: "Visa",
  type: "credit-card",
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

function schedule(
  partial: Partial<BudgetScheduledTransaction> &
    Pick<BudgetScheduledTransaction, "id" | "nextDate" | "amount" | "type">,
): BudgetScheduledTransaction {
  return {
    frequency: "monthly",
    payee: partial.payee ?? "Recurring",
    accountId: partial.accountId ?? chequing.id,
    categoryId: partial.categoryId ?? null,
    active: true,
    ...partial,
  };
}

assert(
  nextScheduledDate("2026-01-31", "monthly") === "2026-02-28",
  "Monthly from Jan 31 clamps to Feb 28",
);
assert(
  nextScheduledDate("2026-01-15", "weekly") === "2026-01-22",
  "Weekly adds 7 days",
);
assert(
  nextScheduledDate("2026-01-15", "every-2-weeks") === "2026-01-29",
  "Every 2 weeks adds 14 days",
);
assert(
  nextScheduledDate("2026-01-15", "yearly") === "2027-01-15",
  "Yearly adds one year",
);
assert(
  addMonthsToDateKey("2024-01-31", 1) === "2024-02-29",
  "Monthly clamps to leap-day when present",
);

const noScheduleLegacy = normalizeBudgetPlan({
  ...makePlan(),
  scheduledTransactions: undefined,
} as unknown as BudgetPlan);
assert(
  Array.isArray(noScheduleLegacy.scheduledTransactions) &&
    noScheduleLegacy.scheduledTransactions.length === 0,
  "Plans saved without schedules still load with an empty schedule list",
);

const monthlyRent = makePlan({
  scheduledTransactions: [
    schedule({
      id: "sched-rent",
      nextDate: "2026-03-01",
      amount: 120,
      type: "outflow",
      payee: "Landlord",
      categoryId: "groceries",
      frequency: "monthly",
    }),
  ],
  monthBudgets: { "2026-03": { assignments: { groceries: 400 } } },
});

const beforeDue = materializeDueSchedules(monthlyRent, "2026-02-28");
assert(beforeDue === monthlyRent, "Nothing posts before the due date (same plan reference)");
assert(beforeDue.transactions.length === 0, "No posted copy before the due date");

const onDue = materializeDueSchedules(monthlyRent, "2026-03-01");
assert(onDue !== monthlyRent, "Materialize returns a new plan when something posts");
assert(onDue.transactions.length === 1, "Due monthly outflow posts once");
assert(
  onDue.transactions[0]?.payee === "Landlord" &&
    onDue.transactions[0]?.type === "outflow" &&
    onDue.transactions[0]?.amount === 120 &&
    onDue.transactions[0]?.categoryId === "groceries" &&
    onDue.transactions[0]?.scheduledTransactionId === "sched-rent" &&
    onDue.transactions[0]?.cleared === "uncleared",
  "Posted copy is a normal outflow linked to the schedule",
);
assert(
  onDue.scheduledTransactions[0]?.nextDate === "2026-04-01",
  "Monthly schedule advances to the next date after posting",
);

const again = materializeDueSchedules(onDue, "2026-03-01");
assert(
  again.transactions.length === 1 &&
    again.scheduledTransactions[0]?.nextDate === "2026-04-01",
  "Re-opening the same day does not post a second copy",
);

const catchUp = materializeDueSchedules(monthlyRent, "2026-05-01");
assert(
  catchUp.transactions.length === 3 &&
    catchUp.scheduledTransactions[0]?.nextDate === "2026-06-01",
  "Catch-up posts March, April, and May when the plan is opened in May",
);

const remaining = makePlan({
  scheduledTransactions: [
    schedule({
      id: "sched-count",
      nextDate: "2026-01-05",
      amount: 10,
      type: "outflow",
      frequency: "weekly",
      remainingCount: 2,
    }),
  ],
});
const afterCount = materializeDueSchedules(remaining, "2026-02-01");
assert(
  afterCount.transactions.length === 2 &&
    afterCount.scheduledTransactions[0]?.remainingCount === 0 &&
    afterCount.scheduledTransactions[0]?.active === false,
  "Remaining count stops posting and deactivates the schedule",
);

const ended = makePlan({
  scheduledTransactions: [
    schedule({
      id: "sched-end",
      nextDate: "2026-01-10",
      amount: 10,
      type: "outflow",
      frequency: "weekly",
      endDate: "2026-01-17",
    }),
  ],
});
const afterEnd = materializeDueSchedules(ended, "2026-03-01");
assert(
  afterEnd.transactions.length === 2 &&
    afterEnd.scheduledTransactions[0]?.active === false,
  "End date posts 1/10 and 1/17, then the schedule stops",
);

const postedThenEdited = materializeDueSchedules(
  makePlan({
    scheduledTransactions: [
      schedule({
        id: "sched-edit",
        nextDate: "2026-01-01",
        amount: 40,
        type: "outflow",
        payee: "Original Payee",
        categoryId: "groceries",
        frequency: "monthly",
      }),
    ],
  }),
  "2026-01-01",
);
const afterFutureEdit = {
  ...postedThenEdited,
  scheduledTransactions: postedThenEdited.scheduledTransactions.map((row) =>
    row.id === "sched-edit"
      ? { ...row, payee: "New Payee", amount: 99, nextDate: "2026-02-01" }
      : row,
  ),
};
assert(
  afterFutureEdit.transactions[0]?.payee === "Original Payee" &&
    afterFutureEdit.transactions[0]?.amount === 40,
  "Editing the schedule does not rewrite already-posted history",
);

const splitSchedule = materializeDueSchedules(
  makePlan({
    categories: [
      { id: "groceries", groupId: "g1", name: "Groceries", sortOrder: 0 },
      { id: "rent", groupId: "g1", name: "Rent", sortOrder: 1 },
    ],
    scheduledTransactions: [
      schedule({
        id: "sched-split",
        nextDate: "2026-01-08",
        amount: 80,
        type: "outflow",
        payee: "Warehouse",
        splits: [
          { id: "s1", categoryId: "groceries", amount: 50 },
          { id: "s2", categoryId: "rent", amount: 30 },
        ],
      }),
    ],
  }),
  "2026-01-08",
);
assert(
  splitSchedule.transactions[0]?.splits?.length === 2 &&
    splitSchedule.transactions[0]?.categoryId === null &&
    getCategoryActivity(splitSchedule.transactions, "groceries", "2026-01") === 50,
  "Scheduled split outflow posts with lines that still hit category activity",
);

const transferSchedule = materializeDueSchedules(
  makePlan({
    accounts: [chequing, creditCard],
    scheduledTransactions: [
      schedule({
        id: "sched-xfer",
        nextDate: "2026-01-12",
        amount: 150,
        type: "transfer",
        payee: "Transfer to Visa",
        transferAccountId: creditCard.id,
      }),
    ],
    transactions: [
      tx({
        id: "in-jan",
        date: "2026-01-02",
        amount: 1000,
        type: "inflow",
      }),
    ],
    monthBudgets: { "2026-01": { assignments: { groceries: 400 } } },
  }),
  "2026-01-12",
);
assert(
  transferSchedule.transactions.some((row) => row.type === "transfer") &&
    getReadyToAssign(transferSchedule, "2026-01") === 600,
  "Scheduled transfer posts as a transfer and does not change Ready to Assign",
);

const upcoming = getUpcomingScheduledInstances(
  [
    schedule({
      id: "sched-upcoming",
      nextDate: "2026-04-03",
      amount: 25,
      type: "outflow",
      frequency: "weekly",
    }),
  ],
  { fromDate: "2026-04-01", horizonDays: 21, limitPerSchedule: 3 },
);
assert(
  upcoming.length === 3 &&
    upcoming[0]?.date === "2026-04-03" &&
    upcoming[1]?.date === "2026-04-10",
  "Upcoming list previews the next scheduled instances without posting them",
);

const legacyWithCard = normalizeBudgetPlan(
  makePlan({
    accounts: [chequing, creditCard],
    transactions: [
      tx({
        id: "in-jan",
        date: "2026-01-02",
        amount: 1000,
        type: "inflow",
      }),
      tx({
        id: "cc-charge",
        date: "2026-01-08",
        amount: 200,
        type: "outflow",
        accountId: creditCard.id,
        categoryId: "groceries",
        payee: "Store",
      }),
    ],
    monthBudgets: { "2026-01": { assignments: { groceries: 400 } } },
    scheduledTransactions: undefined,
  } as unknown as BudgetPlan),
);

const paymentGroup = legacyWithCard.categoryGroups.find(
  (group) => group.kind === "credit-card-payments",
);
const paymentCat = paymentCategoryForAccount(
  legacyWithCard.categories,
  creditCard.id,
);
assert(
  paymentGroup?.name === CREDIT_CARD_PAYMENTS_GROUP_NAME &&
    paymentCat?.name === "Visa Payment" &&
    paymentCat?.creditCardAccountId === creditCard.id,
  "Existing credit-card accounts get a payment category on normalize",
);
assert(
  legacyWithCard.categories.some((category) => category.id === "groceries") &&
    legacyWithCard.monthBudgets["2026-01"]?.assignments.groceries === 400 &&
    legacyWithCard.transactions.length === 2,
  "Normalize does not wipe user categories, assignments, or transactions",
);

const paymentId = paymentCat!.id;
assert(
  getCategoryActivity(
    legacyWithCard.transactions,
    paymentId,
    "2026-01",
    creditCard.id,
  ) === -200,
  "Card spend is negative payment-category activity (raises available)",
);
assert(
  getCategoryAvailable(legacyWithCard, paymentId, "2026-01") === 200,
  "Spending $200 on the card raises payment-category available by $200",
);
assert(
  getCategoryAvailable(legacyWithCard, "groceries", "2026-01") === 200,
  "The spending category still records the card charge (400 − 200)",
);
assert(
  getAccountBalance(creditCard, legacyWithCard.transactions) === 200,
  "Liability sign: card outflow increases balance owed",
);

const afterPayment = {
  ...legacyWithCard,
  transactions: [
    ...legacyWithCard.transactions,
    tx({
      id: "pay-card",
      date: "2026-01-20",
      amount: 150,
      type: "transfer",
      accountId: chequing.id,
      transferAccountId: creditCard.id,
      payee: "Transfer to Visa",
    }),
  ],
};
assert(
  computeMonthSummary(afterPayment, "2026-01").readyToAssign === 600,
  "Paying the card via transfer does not change Ready to Assign",
);
assert(
  computeMonthSummary(afterPayment, "2026-01").totalSpent === 200,
  "Card payment transfer is not spending (only the $200 charge counts)",
);
assert(
  getCategoryActivity(afterPayment.transactions, "groceries", "2026-01") === 200,
  "Card payment transfer does not hit Groceries activity",
);
assert(
  getCategoryAvailable(afterPayment, paymentId, "2026-01") === 50,
  "Transfer to the card reduces payment-category available (200 − 150)",
);
assert(
  getAccountBalance(creditCard, afterPayment.transactions) === 50,
  "Payment transfer reduces the liability (200 owed − 150 paid)",
);
assert(
  getSpendingByCategory(afterPayment, "2026-01").every(
    (row) => row.categoryId !== paymentId,
  ),
  "Reports do not treat the payment category as spending",
);

const assignedToPayment = {
  ...afterPayment,
  monthBudgets: {
    "2026-01": { assignments: { groceries: 400, [paymentId]: 50 } },
  },
};
assert(
  getReadyToAssign(assignedToPayment, "2026-01") === 550,
  "Assigning to the payment category spends Ready to Assign like any other job",
);
assert(
  getCategoryAvailable(assignedToPayment, paymentId, "2026-01") === 100,
  "Assigned $50 plus leftover $50 from card activity is available to pay",
);

const noCardAgain = ensureCreditCardPaymentCategories(
  makePlan({ accounts: [chequing] }),
);
assert(
  !noCardAgain.categoryGroups.some((group) => group.kind === "credit-card-payments"),
  "Plans without a credit card do not get a payment group",
);

const emptyAom = computeAgeOfMoney([]);
assert(
  emptyAom.status === "empty" && emptyAom.days === null,
  "Empty budget Age of Money is empty, not a fake number",
);

const fewOutflows: BudgetTransaction[] = [
  tx({ id: "in-1", date: "2026-01-01", amount: 500, type: "inflow" }),
  tx({
    id: "out-1",
    date: "2026-01-11",
    amount: 10,
    type: "outflow",
    categoryId: "groceries",
  }),
  tx({
    id: "out-2",
    date: "2026-01-12",
    amount: 10,
    type: "outflow",
    categoryId: "groceries",
  }),
  tx({
    id: "out-3",
    date: "2026-01-13",
    amount: 10,
    type: "outflow",
    categoryId: "groceries",
  }),
];
const shortAom = computeAgeOfMoney(fewOutflows);
assert(
  shortAom.status === "insufficient" &&
    shortAom.days === null &&
    shortAom.outflowCount === 3,
  "Fewer than 10 outflows is insufficient history, not a guessed Age of Money",
);

const tenDayOutflows: BudgetTransaction[] = [
  tx({ id: "in-fifo", date: "2026-01-01", amount: 100, type: "inflow" }),
  ...Array.from({ length: 10 }, (_, index) =>
    tx({
      id: `out-fifo-${index}`,
      date: "2026-01-11",
      amount: 10,
      type: "outflow",
      categoryId: "groceries",
    }),
  ),
];
const tenDayAom = computeAgeOfMoney(tenDayOutflows);
assert(
  daysBetweenDateKeys("2026-01-01", "2026-01-11") === 10,
  "Date-key day count is calendar days",
);
assert(
  tenDayAom.status === "ready" && tenDayAom.days === 10,
  "FIFO: $100 in on Jan 1, ten $10 spends on Jan 11 → Age of Money is 10 days",
);

const weighted: BudgetTransaction[] = [
  tx({ id: "in-a", date: "2026-01-01", amount: 50, type: "inflow" }),
  tx({ id: "in-b", date: "2026-01-20", amount: 50, type: "inflow" }),
  ...Array.from({ length: 10 }, (_, index) =>
    tx({
      id: `out-w-${index}`,
      date: "2026-01-25",
      amount: 10,
      type: "outflow",
      categoryId: "groceries",
    }),
  ),
];
const weightedAom = computeAgeOfMoney(weighted);
assert(
  weightedAom.status === "ready" && weightedAom.days === 15,
  "FIFO weighted average: 50×24d + 50×5d = 14.5 → 15 days",
);

const transfersOnly = computeAgeOfMoney([
  tx({
    id: "xfer-only",
    date: "2026-01-10",
    amount: 300,
    type: "transfer",
    transferAccountId: creditCard.id,
  }),
]);
assert(
  transfersOnly.status === "empty" && transfersOnly.days === null,
  "Transfers are not income or spending for Age of Money",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall budget parity unit checks passed");
