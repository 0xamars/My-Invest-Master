/**
 * Budget Ready to Assign + category available month carry (YNAB-style).
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-calculations-unit.mts
 */
import {
  buildCategoryRows,
  computeMonthSummary,
  getCategoryAvailable,
  getMonthAssignments,
  getReadyToAssign,
  getTransactionsForMonth,
} from "../src/lib/budget/calculations.ts";
import { shiftMonthKey, type BudgetData, type BudgetTransaction } from "../src/types/budget.ts";

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
      .filter((row) => row.type === "inflow")
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

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall budget calculation unit checks passed");
