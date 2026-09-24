/**
 * Credit-card envelope behavior: funded purchases, existing debt, returns,
 * cash advances, and overpaying the card.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-credit-card-unit.mts
 */
import { getAccountBalance } from "../src/lib/budget/accounts.ts";
import {
  moveCategoryGroupInBudget,
  moveCategoryInBudget,
  removeCategoryFromBudget,
} from "../src/lib/budget/category-mutations.ts";
import {
  computeMonthSummary,
  getCategoryAvailable,
  getReadyToAssign,
} from "../src/lib/budget/calculations.ts";
import { paymentCategoryForAccount } from "../src/lib/budget/credit-card-payments.ts";
import { applyMonthClose, applyMonthNote } from "../src/lib/budget/month-close.ts";
import { normalizeBudgetPlan } from "../src/lib/budget/migrate-plan.ts";
import {
  buildStartingBalanceTransaction,
  STARTING_BALANCE_PAYEE,
} from "../src/lib/budget/starting-balance.ts";
import type { BudgetAccount, BudgetPlan, BudgetTransaction } from "../src/types/budget.ts";

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
  return normalizeBudgetPlan({
    id: "plan-1",
    name: "Plan",
    accounts: [chequing, creditCard],
    categoryGroups: [{ id: "g1", name: "Living", sortOrder: 0 }],
    categories: [
      { id: "groceries", groupId: "g1", name: "Groceries", sortOrder: 0 },
      { id: "dining", groupId: "g1", name: "Dining", sortOrder: 1 },
    ],
    transactions: [],
    scheduledTransactions: [],
    monthBudgets: {},
    goals: [],
    closedThrough: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

function paymentId(plan: BudgetPlan): string {
  const category = paymentCategoryForAccount(plan.categories, creditCard.id);
  if (!category) throw new Error("missing payment category");
  return category.id;
}

const funded = makePlan({
  transactions: [
    tx({ id: "in", date: "2026-01-02", amount: 500, type: "inflow" }),
    tx({
      id: "charge",
      date: "2026-01-08",
      amount: 80,
      type: "outflow",
      accountId: creditCard.id,
      categoryId: "groceries",
      payee: "Market",
    }),
  ],
  monthBudgets: { "2026-01": { assignments: { groceries: 200 } } },
});
const payId = paymentId(funded);

assert(
  getCategoryAvailable(funded, "groceries", "2026-01") === 120,
  "Funded card purchase reduces the spending envelope (200 − 80)",
);
assert(
  getCategoryAvailable(funded, payId, "2026-01") === 80,
  "Funded card purchase moves $80 into the payment envelope",
);
assert(
  getReadyToAssign(funded, "2026-01") === 300,
  "Card purchase does not change leftover (500 − 200 assigned)",
);
assert(
  getAccountBalance(creditCard, funded.transactions) === 80,
  "Card purchase increases the balance owed",
);

const debt = makePlan({
  transactions: [
    tx({ id: "in", date: "2026-01-02", amount: 500, type: "inflow" }),
    tx({
      id: "opening",
      date: "2026-01-01",
      amount: 240,
      type: "outflow",
      accountId: creditCard.id,
      categoryId: null,
      payee: STARTING_BALANCE_PAYEE,
    }),
  ],
});
assert(
  getAccountBalance(creditCard, debt.transactions) === 240,
  "Uncategorized card outflow is existing debt",
);
assert(
  getCategoryAvailable(debt, paymentId(debt), "2026-01") === 0,
  "Existing card debt does not fund the payment envelope",
);
assert(
  getReadyToAssign(debt, "2026-01") === 500,
  "Existing card debt does not take leftover",
);
const debtFunded = {
  ...debt,
  monthBudgets: { "2026-01": { assignments: { [paymentId(debt)]: 240 } } },
};
assert(
  getCategoryAvailable(debtFunded, paymentId(debt), "2026-01") === 240,
  "Assigning to the payment envelope sets aside cash for old debt",
);
assert(
  getReadyToAssign(debtFunded, "2026-01") === 260,
  "Assigning for old debt spends leftover",
);

const sameMonthReturn = makePlan({
  transactions: [
    ...funded.transactions,
    tx({
      id: "refund",
      date: "2026-01-20",
      amount: 30,
      type: "inflow",
      accountId: creditCard.id,
      categoryId: "groceries",
      payee: "Market",
    }),
  ],
  monthBudgets: funded.monthBudgets,
});
assert(
  getCategoryAvailable(sameMonthReturn, "groceries", "2026-01") === 150,
  "Same-month card return goes back to the spending envelope (120 + 30)",
);
assert(
  getCategoryAvailable(sameMonthReturn, paymentId(sameMonthReturn), "2026-01") === 50,
  "Same-month card return leaves the payment envelope (80 − 30)",
);
assert(
  getReadyToAssign(sameMonthReturn, "2026-01") === getReadyToAssign(funded, "2026-01"),
  "A categorized card return does not change leftover",
);
assert(
  getAccountBalance(creditCard, sameMonthReturn.transactions) === 50,
  "Card return reduces the balance owed",
);
assert(
  computeMonthSummary(sameMonthReturn, "2026-01").totalSpent === 50,
  "A categorized return reduces this-month spending (80 − 30)",
);

const creditHole = makePlan({
  transactions: [
    tx({ id: "in", date: "2026-01-02", amount: 400, type: "inflow" }),
    tx({
      id: "charge",
      date: "2026-01-10",
      amount: 150,
      type: "outflow",
      accountId: creditCard.id,
      categoryId: "groceries",
    }),
  ],
  monthBudgets: { "2026-01": { assignments: { groceries: 100 } } },
});
assert(
  getCategoryAvailable(creditHole, "groceries", "2026-02") === -50,
  "Credit overspend carries into the next month",
);
const holeReturn = {
  ...creditHole,
  transactions: [
    ...creditHole.transactions,
    tx({
      id: "refund-later",
      date: "2026-02-04",
      amount: 150,
      type: "inflow",
      accountId: creditCard.id,
      categoryId: "groceries",
    }),
  ],
};
assert(
  getCategoryAvailable(holeReturn, "groceries", "2026-02") === 100,
  "Returning a mixed charge fills the credit hole and gives back the funded part",
);
assert(
  getCategoryAvailable(holeReturn, paymentId(holeReturn), "2026-02") === 0,
  "The payment envelope does not keep dollars after the return",
);
assert(
  getReadyToAssign(holeReturn, "2026-02") === getReadyToAssign(creditHole, "2026-02"),
  "Returning credit overspend does not create leftover",
);

const unfundedOnly = makePlan({
  transactions: [
    tx({
      id: "charge",
      date: "2026-01-10",
      amount: 40,
      type: "outflow",
      accountId: creditCard.id,
      categoryId: "groceries",
    }),
    tx({
      id: "refund",
      date: "2026-02-02",
      amount: 40,
      type: "inflow",
      accountId: creditCard.id,
      categoryId: "groceries",
    }),
  ],
});
assert(
  getCategoryAvailable(unfundedOnly, "groceries", "2026-02") === 0,
  "Refunding unfunded card spend clears the hole without creating cash",
);
assert(
  getCategoryAvailable(unfundedOnly, paymentId(unfundedOnly), "2026-02") === 0,
  "Refunding unfunded card spend leaves the payment envelope at zero",
);
assert(
  getReadyToAssign(unfundedOnly, "2026-02") === 0,
  "Refunding unfunded card spend does not create leftover",
);

const excess = makePlan({
  transactions: [
    tx({
      id: "charge",
      date: "2026-01-10",
      amount: 40,
      type: "outflow",
      accountId: creditCard.id,
      categoryId: "groceries",
    }),
    tx({
      id: "refund",
      date: "2026-02-02",
      amount: 70,
      type: "inflow",
      accountId: creditCard.id,
      categoryId: "groceries",
    }),
  ],
});
assert(
  getCategoryAvailable(excess, "groceries", "2026-02") === 0,
  "A return larger than funded spending does not invent envelope money",
);
assert(
  getCategoryAvailable(excess, paymentId(excess), "2026-02") === 0,
  "Extra card credit does not drive the payment envelope negative",
);
assert(getReadyToAssign(excess, "2026-02") === 0, "Extra card credit is not leftover");
assert(
  getAccountBalance(creditCard, excess.transactions) === -30,
  "Extra return becomes a credit balance on the card",
);

const toLeftover = makePlan({
  transactions: [
    ...funded.transactions,
    tx({
      id: "refund-rta",
      date: "2026-01-21",
      amount: 80,
      type: "inflow",
      accountId: creditCard.id,
      categoryId: null,
      payee: "Market",
    }),
  ],
  monthBudgets: funded.monthBudgets,
});
assert(
  getReadyToAssign(toLeftover, "2026-01") === getReadyToAssign(funded, "2026-01") + 80,
  "Unassigned card return frees leftover that the payment envelope was holding",
);
assert(
  getCategoryAvailable(toLeftover, paymentId(toLeftover), "2026-01") === 0,
  "Unassigned card return empties the payment envelope",
);
assert(
  getCategoryAvailable(toLeftover, "groceries", "2026-01") === 120,
  "Unassigned card return does not put dollars back in Groceries",
);

const unbackedReturn = makePlan({
  transactions: [
    tx({
      id: "charge",
      date: "2026-01-10",
      amount: 40,
      type: "outflow",
      accountId: creditCard.id,
      categoryId: "groceries",
    }),
    tx({
      id: "refund-rta",
      date: "2026-01-12",
      amount: 40,
      type: "inflow",
      accountId: creditCard.id,
      categoryId: null,
    }),
  ],
});
assert(
  getReadyToAssign(unbackedReturn, "2026-01") === 0,
  "An unassigned return of unfunded card spend does not create leftover",
);
assert(
  getCategoryAvailable(unbackedReturn, paymentId(unbackedReturn), "2026-01") === 0,
  "An unassigned return of unfunded card spend does not make the payment envelope negative",
);

const advance = makePlan({
  transactions: [
    tx({
      id: "advance",
      date: "2026-01-15",
      amount: 60,
      type: "transfer",
      accountId: creditCard.id,
      transferAccountId: chequing.id,
      payee: "Cash advance",
    }),
  ],
});
assert(
  getReadyToAssign(advance, "2026-01") === 60,
  "Cash advance adds leftover",
);
assert(
  getCategoryAvailable(advance, paymentId(advance), "2026-01") === 0,
  "Cash advance does not fund the payment envelope",
);
assert(
  getAccountBalance(creditCard, advance.transactions) === 60,
  "Cash advance increases the balance owed",
);
assert(
  getAccountBalance(chequing, advance.transactions) === 60,
  "Cash advance increases the cash account",
);

const overpay = makePlan({
  transactions: [
    tx({ id: "in", date: "2026-01-02", amount: 300, type: "inflow" }),
    tx({
      id: "charge",
      date: "2026-01-08",
      amount: 40,
      type: "outflow",
      accountId: creditCard.id,
      categoryId: "groceries",
    }),
    tx({
      id: "pay",
      date: "2026-01-20",
      amount: 90,
      type: "transfer",
      accountId: chequing.id,
      transferAccountId: creditCard.id,
    }),
  ],
  monthBudgets: { "2026-01": { assignments: { groceries: 40 } } },
});
assert(
  getCategoryAvailable(overpay, paymentId(overpay), "2026-01") === -50,
  "Paying more than the payment envelope shows cash overspend",
);
assert(
  getReadyToAssign(overpay, "2026-01") === 260,
  "Overpaying the card does not reduce leftover until the month is closed",
);
const closed = applyMonthClose(overpay, "2026-01", {
  now: new Date("2026-02-01T12:00:00"),
  closedAt: "2026-02-01T12:00:00.000Z",
});
assert(
  getCategoryAvailable(closed, paymentId(closed), "2026-02") === 0,
  "Closed card overpay resets the payment envelope to zero",
);
assert(
  getReadyToAssign(closed, "2026-02") === 210,
  "Closed card overpay reduces next-month leftover (260 − 50)",
);

const interest = makePlan({
  transactions: [
    tx({ id: "in", date: "2026-01-02", amount: 100, type: "inflow" }),
    tx({
      id: "fee",
      date: "2026-01-28",
      amount: 15,
      type: "outflow",
      accountId: creditCard.id,
      categoryId: "dining",
      payee: "Interest",
    }),
  ],
  monthBudgets: { "2026-01": { assignments: { dining: 15 } } },
});
assert(
  getCategoryAvailable(interest, paymentId(interest), "2026-01") === 15 &&
    getCategoryAvailable(interest, "dining", "2026-01") === 0 &&
    getAccountBalance(creditCard, interest.transactions) === 15,
  "Interest categorized on the card moves funded dollars into the payment envelope",
);

const opening = buildStartingBalanceTransaction({
  id: "open-1",
  account: creditCard,
  amount: 125.126,
  date: "2026-01-01",
});
assert(
  opening?.type === "outflow" &&
    opening.categoryId === null &&
    opening.amount === 125.13 &&
    opening.payee === STARTING_BALANCE_PAYEE,
  "Card starting balance is an uncategorized outflow rounded to cents",
);
const cashOpening = buildStartingBalanceTransaction({
  id: "open-2",
  account: chequing,
  amount: 40,
  date: "2026-01-01",
});
assert(
  cashOpening?.type === "inflow" && cashOpening.categoryId === null,
  "Cash starting balance is an inflow to leftover",
);
assert(
  buildStartingBalanceTransaction({
    id: "open-3",
    account: chequing,
    amount: 0,
    date: "2026-01-01",
  }) === null,
  "A zero starting balance is not recorded",
);

const withClose = makePlan({
  monthBudgets: {
    "2026-01": {
      assignments: { groceries: 10 },
      closedAt: "2026-02-01T00:00:00.000Z",
      opening: { leftover: 5, envelopes: { groceries: 10, dining: 2 } },
      note: "Rent posted late",
    },
  },
});
const deleted = removeCategoryFromBudget(withClose, "dining");
assert(
  deleted.monthBudgets["2026-01"]?.closedAt === "2026-02-01T00:00:00.000Z" &&
    deleted.monthBudgets["2026-01"]?.note === "Rent posted late" &&
    deleted.monthBudgets["2026-01"]?.opening?.envelopes.groceries === 10 &&
    deleted.monthBudgets["2026-01"]?.opening?.envelopes.dining === undefined,
  "Deleting an envelope keeps the month close, note, and other opening balances",
);

const noted = applyMonthNote(funded, "2026-01", "  Wait for the refund  ");
assert(
  noted.monthBudgets["2026-01"]?.note === "Wait for the refund" &&
    getReadyToAssign(noted, "2026-01") === getReadyToAssign(funded, "2026-01"),
  "A month note is stored and does not change leftover",
);

const reordered = moveCategoryInBudget(funded, "dining", "up");
assert(
  reordered.categories.find((category) => category.id === "dining")?.sortOrder === 0 &&
    reordered.categories.find((category) => category.id === "groceries")?.sortOrder === 1,
  "Move envelope up swaps sort order inside the group",
);
const groups = moveCategoryGroupInBudget(
  {
    ...funded,
    categoryGroups: [
      ...funded.categoryGroups,
      { id: "g2", name: "Fun", sortOrder: 1 },
    ],
  },
  "g2",
  "up",
);
const userGroups = groups.categoryGroups
  .filter((group) => group.kind !== "credit-card-payments")
  .sort((a, b) => a.sortOrder - b.sortOrder);
assert(
  userGroups[0]?.id === "g2" && userGroups[1]?.id === "g1",
  "Move group up reorders user groups and leaves the payment group pinned",
);

const kept = normalizeBudgetPlan(
  makePlan({
    transactions: [
      tx({
        id: "refund",
        date: "2026-01-20",
        amount: 12,
        type: "inflow",
        accountId: creditCard.id,
        categoryId: "groceries",
      }),
    ],
  }),
);
assert(
  kept.transactions.find((row) => row.id === "refund")?.categoryId === "groceries",
  "Normalize keeps a category on a card return",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall credit-card unit checks passed");
