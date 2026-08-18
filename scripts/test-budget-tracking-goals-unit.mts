/**
 * Tracking accounts, net worth, and real goal types.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-tracking-goals-unit.mts
 */
import { getAccountBalance } from "../src/lib/budget/accounts.ts";
import {
  computeMonthSummary,
  getCategoryActivity,
  getCategoryAvailable,
  getReadyToAssign,
} from "../src/lib/budget/calculations.ts";
import {
  ensureCreditCardPaymentCategories,
  paymentCategoryForAccount,
} from "../src/lib/budget/credit-card-payments.ts";
import { computeGoalProgress } from "../src/lib/budget/goals.ts";
import { normalizeBudgetPlan } from "../src/lib/budget/migrate-plan.ts";
import { getNetWorthSnapshot } from "../src/lib/budget/reports.ts";
import type {
  BudgetAccount,
  BudgetPlan,
  BudgetTransaction,
  CategoryGoal,
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
  onBudget: true,
  sortOrder: 0,
};
const brokerage: BudgetAccount = {
  id: "acct-brokerage",
  name: "Brokerage",
  type: "brokerage",
  onBudget: false,
  sortOrder: 1,
};
const mortgage: BudgetAccount = {
  id: "acct-mortgage",
  name: "Mortgage",
  type: "mortgage",
  onBudget: false,
  sortOrder: 2,
};
const creditCard: BudgetAccount = {
  id: "acct-cc",
  name: "Visa",
  type: "credit-card",
  onBudget: true,
  sortOrder: 3,
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

const trackingPlan = makePlan({
  accounts: [chequing, brokerage, mortgage],
  transactions: [
    tx({
      id: "in-jan",
      date: "2026-01-02",
      amount: 1000,
      type: "inflow",
      accountId: chequing.id,
    }),
    tx({
      id: "track-in",
      date: "2026-01-03",
      amount: 4000,
      type: "inflow",
      accountId: brokerage.id,
      payee: "Vested shares",
    }),
    tx({
      id: "track-out",
      date: "2026-01-08",
      amount: 100,
      type: "outflow",
      accountId: brokerage.id,
      categoryId: "groceries",
      payee: "Broker fee",
    }),
  ],
  monthBudgets: { "2026-01": { assignments: { groceries: 400 } } },
});

assert(
  computeMonthSummary(trackingPlan, "2026-01").readyToAssign === 600,
  "Tracking inflow does not change Ready to Assign (1000 − 400)",
);
assert(
  getReadyToAssign(trackingPlan, "2026-01") === 600,
  "Tracking outflow does not change Ready to Assign",
);
assert(
  getCategoryActivity(
    trackingPlan.transactions,
    "groceries",
    "2026-01",
    undefined,
    trackingPlan.accounts,
  ) === 0,
  "Tracking outflow does not change on-budget category Activity",
);
assert(
  getCategoryAvailable(trackingPlan, "groceries", "2026-01") === 400,
  "Tracking outflow does not change Groceries available",
);
assert(
  getAccountBalance(brokerage, trackingPlan.transactions) === 3900,
  "Tracking account balance still moves (4000 − 100)",
);

const outToTracking = {
  ...trackingPlan,
  transactions: [
    ...trackingPlan.transactions,
    tx({
      id: "to-brokerage",
      date: "2026-01-10",
      amount: 200,
      type: "transfer",
      accountId: chequing.id,
      transferAccountId: brokerage.id,
      payee: "Transfer to Brokerage",
    }),
  ],
};
assert(
  getReadyToAssign(outToTracking, "2026-01") === 400,
  "On-budget → tracking transfer reduces Ready to Assign (600 − 200)",
);
assert(
  getAccountBalance(chequing, outToTracking.transactions) === 800,
  "On-budget side of the transfer leaves chequing (1000 − 200)",
);
assert(
  getAccountBalance(brokerage, outToTracking.transactions) === 4100,
  "Tracking side of the transfer only moves the brokerage balance",
);

const inFromTracking = {
  ...outToTracking,
  transactions: [
    ...outToTracking.transactions,
    tx({
      id: "from-brokerage",
      date: "2026-01-12",
      amount: 50,
      type: "transfer",
      accountId: brokerage.id,
      transferAccountId: chequing.id,
      payee: "Transfer to Chequing",
    }),
  ],
};
assert(
  getReadyToAssign(inFromTracking, "2026-01") === 450,
  "Tracking → on-budget transfer increases Ready to Assign (400 + 50)",
);

const trackingToTracking = {
  ...inFromTracking,
  transactions: [
    ...inFromTracking.transactions,
    tx({
      id: "track-xfer",
      date: "2026-01-14",
      amount: 25,
      type: "transfer",
      accountId: brokerage.id,
      transferAccountId: mortgage.id,
      payee: "Transfer to Mortgage",
    }),
  ],
};
assert(
  getReadyToAssign(trackingToTracking, "2026-01") === 450,
  "Tracking → tracking transfer does not change Ready to Assign",
);
assert(
  getAccountBalance(mortgage, trackingToTracking.transactions) === -25,
  "Mortgage tracking liability records the inbound transfer on its balance",
);

const netWorthPlan = makePlan({
  accounts: [chequing, brokerage, creditCard],
  transactions: [
    tx({
      id: "in-nw",
      date: "2026-01-02",
      amount: 1000,
      type: "inflow",
      accountId: chequing.id,
    }),
    tx({
      id: "br-nw",
      date: "2026-01-03",
      amount: 4000,
      type: "inflow",
      accountId: brokerage.id,
    }),
    tx({
      id: "cc-nw",
      date: "2026-01-08",
      amount: 200,
      type: "outflow",
      accountId: creditCard.id,
      categoryId: "groceries",
    }),
  ],
});
const netWorth = getNetWorthSnapshot(
  netWorthPlan.accounts,
  netWorthPlan.transactions,
  "2026-01",
);
assert(
  netWorth.assets === 5000 &&
    netWorth.liabilities === 200 &&
    netWorth.netWorth === 4800,
  "Net worth sums on-budget + tracking assets minus credit-card liability (5000 − 200)",
);
assert(
  netWorth.assetAccounts.some((row) => row.account.id === brokerage.id) &&
    netWorth.liabilityAccounts.some((row) => row.account.id === creditCard.id),
  "Brokerage is an asset; credit card stays a liability",
);

const laterNetWorth = getNetWorthSnapshot(
  netWorthPlan.accounts,
  netWorthPlan.transactions,
  "2025-12",
);
assert(
  laterNetWorth.netWorth === 0,
  "Net worth through a month before any transactions is $0",
);

const monthlyGoal: CategoryGoal = {
  id: "goal-monthly",
  categoryId: "groceries",
  type: "monthly-funding",
  targetAmount: 80,
};
const monthlyUnder = computeGoalProgress(monthlyGoal, "2026-01", {
  assignedThisMonth: 0,
  assignedBeforeMonth: 0,
  availableBeforeMonth: 0,
});
assert(
  monthlyUnder.neededThisMonth === 80 && monthlyUnder.status === "underfunded",
  "Monthly funding needs the target every month and is underfunded at $0 assigned",
);
const monthlyOnTrack = computeGoalProgress(monthlyGoal, "2026-01", {
  assignedThisMonth: 80,
  assignedBeforeMonth: 0,
  availableBeforeMonth: 0,
});
assert(
  monthlyOnTrack.neededThisMonth === 80 && monthlyOnTrack.status === "on-track",
  "Monthly funding is on-track when this month’s assigned meets the target",
);

const neededGoal: CategoryGoal = {
  id: "goal-needed",
  categoryId: "groceries",
  type: "needed-for-spending",
  targetAmount: 300,
  targetDate: "2026-03-31",
};
const neededJan = computeGoalProgress(neededGoal, "2026-01", {
  assignedThisMonth: 0,
  assignedBeforeMonth: 0,
  availableBeforeMonth: 0,
});
assert(
  neededJan.neededThisMonth === 100 &&
    neededJan.monthsLeft === 3 &&
    neededJan.status === "underfunded",
  "Needed for spending: $300 by March from January is $100 this month (300 / 3)",
);
const neededFeb = computeGoalProgress(neededGoal, "2026-02", {
  assignedThisMonth: 0,
  assignedBeforeMonth: 100,
  availableBeforeMonth: 100,
});
assert(
  neededFeb.neededThisMonth === 100 && neededFeb.remaining === 200,
  "Needed for spending: after $100 assigned in January, February needs 200 / 2 = 100",
);
const neededMarOnTrack = computeGoalProgress(neededGoal, "2026-03", {
  assignedThisMonth: 200,
  assignedBeforeMonth: 100,
  availableBeforeMonth: 100,
});
assert(
  neededMarOnTrack.neededThisMonth === 200 &&
    neededMarOnTrack.status === "on-track",
  "Needed for spending: last month needs the remaining $200 and is on-track when assigned",
);

const legacyGoalPlan = normalizeBudgetPlan({
  ...makePlan({
    goals: [
      {
        id: "old-goal",
        categoryId: "groceries",
        targetAmount: 5000,
        targetDate: "2026-06-01",
        label: "Vacation",
      } as CategoryGoal,
    ],
  }),
});
const migratedGoal = legacyGoalPlan.goals[0];
assert(
  migratedGoal?.type === "target-balance" &&
    migratedGoal.targetAmount === 5000 &&
    migratedGoal.targetDate === "2026-06-01" &&
    migratedGoal.label === "Vacation",
  "Existing goals migrate to target-balance without losing amount, date, or label",
);

const legacyAccountPlan = normalizeBudgetPlan({
  ...makePlan({
    accounts: [
      {
        id: "old-cheq",
        name: "Chequing",
        type: "chequing",
        sortOrder: 0,
      },
    ],
  }),
});
assert(
  legacyAccountPlan.accounts[0]?.onBudget === true,
  "Existing accounts default to on-budget on normalize",
);

const mortgageOnly = ensureCreditCardPaymentCategories(
  makePlan({ accounts: [chequing, mortgage] }),
);
assert(
  !paymentCategoryForAccount(mortgageOnly.categories, mortgage.id) &&
    !mortgageOnly.categoryGroups.some((group) => group.kind === "credit-card-payments"),
  "A mortgage-style tracking account does not get a credit-card payment category",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall budget tracking / net worth / goal unit checks passed");
