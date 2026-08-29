/**
 * Envelope leftover assign + real month close.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-month-close-unit.mts
 */
import { applyAssignLeftover } from "../src/lib/budget/assign-leftover.ts";
import {
  getCategoryAvailable,
  getReadyToAssign,
} from "../src/lib/budget/calculations.ts";
import { isMonthClosed } from "../src/lib/budget/closed-months.ts";
import { applyMoveMoney } from "../src/lib/budget/move-money.ts";
import { applyMonthClose, canCloseMonth, previewMonthClose } from "../src/lib/budget/month-close.ts";
import { normalizeBudgetPlan } from "../src/lib/budget/migrate-plan.ts";
import { getAbsorbedCashOverspend } from "../src/lib/budget/overspend.ts";
import {
  createEmptyBudgetPlan,
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
    cleared: partial.cleared ?? "cleared",
    ...partial,
  };
}

function makePlan(overrides: Partial<BudgetData> = {}): BudgetData {
  return {
    categoryGroups: [{ id: "g1", name: "Living", sortOrder: 0 }],
    categories: [
      { id: "groceries", groupId: "g1", name: "Groceries", sortOrder: 0 },
      { id: "rent", groupId: "g1", name: "Rent", sortOrder: 1 },
    ],
    transactions: [],
    monthBudgets: {},
    goals: [],
    closedThrough: null,
    updatedAt: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

const august = makePlan({
  transactions: [
    tx({
      id: "in-aug",
      date: "2026-08-02",
      amount: 1000,
      type: "inflow",
      payee: "Pay",
    }),
    tx({
      id: "out-aug",
      date: "2026-08-10",
      amount: 80,
      type: "outflow",
      categoryId: "groceries",
    }),
  ],
  monthBudgets: {
    "2026-08": { assignments: { groceries: 200, rent: 400 } },
  },
});

assert(getReadyToAssign(august, "2026-08") === 400, "August leftover is 1000 − 600 assigned");
assert(
  getCategoryAvailable(august, "groceries", "2026-08") === 120,
  "Groceries available is 200 assigned − 80 spent",
);
assert(
  getReadyToAssign(august, "2026-09") === 400,
  "September leftover carries without a close",
);
assert(
  getCategoryAvailable(august, "groceries", "2026-09") === 120,
  "September envelope available carries without a close",
);
assert(
  getAbsorbedCashOverspend(august, "2026-09") === 0,
  "Unclosed August cash overspend is not absorbed yet",
);

const assigned = applyAssignLeftover(august, "2026-08", [
  { categoryId: "groceries", amount: 150 },
  { categoryId: "rent", amount: 300 },
]);
assert(
  getReadyToAssign(assigned, "2026-08") === 0,
  "Assign leftover spends leftover into envelopes (400 requested over 400 leftover → 0)",
);
assert(
  assigned.monthBudgets["2026-08"]?.assignments.groceries === 350,
  "Groceries assigned becomes 200 + 150",
);
assert(
  assigned.monthBudgets["2026-08"]?.assignments.rent === 650,
  "Rent assigned becomes 400 + 250 leftover remainder (300 requested, 250 left)",
);

const leftoverOnly = applyAssignLeftover(august, "2026-08", [
  { categoryId: "rent", amount: 100 },
]);
assert(
  getReadyToAssign(leftoverOnly, "2026-08") === 300,
  "Partial leftover assign leaves 300 unassigned",
);

const overspent = makePlan({
  transactions: [
    tx({ id: "in", date: "2026-08-01", amount: 200, type: "inflow" }),
    tx({
      id: "out",
      date: "2026-08-12",
      amount: 150,
      type: "outflow",
      categoryId: "groceries",
    }),
  ],
  monthBudgets: {
    "2026-08": { assignments: { groceries: 100 } },
  },
});
assert(
  getCategoryAvailable(overspent, "groceries", "2026-08") === -50,
  "August groceries is $50 overspent before close",
);
assert(
  getAbsorbedCashOverspend(overspent, "2026-09") === 0,
  "Viewing September does not absorb unclosed overspend",
);
assert(
  getCategoryAvailable(overspent, "groceries", "2026-09") === -50,
  "Unclosed overspend stays on the envelope in September",
);

const closedOverspend = applyMonthClose(overspent, "2026-08", {
  now: new Date("2026-08-31T12:00:00.000Z"),
  closedAt: "2026-08-31T12:00:00.000Z",
});
assert(closedOverspend.closedThrough === "2026-08", "Close persists closedThrough");
assert(
  closedOverspend.monthBudgets["2026-08"]?.closedAt === "2026-08-31T12:00:00.000Z",
  "Close persists closedAt on the month",
);
assert(isMonthClosed(closedOverspend, "2026-08"), "August is closed after close");
assert(
  getAbsorbedCashOverspend(closedOverspend, "2026-09") === 50,
  "Close absorbs August cash overspend into leftover",
);
assert(
  getReadyToAssign(closedOverspend, "2026-09") === 50,
  "September leftover is 100 unassigned − 50 absorbed overspend",
);
assert(
  getCategoryAvailable(closedOverspend, "groceries", "2026-09") === 0,
  "Closed cash overspend resets envelope available to $0",
);
assert(
  closedOverspend.monthBudgets["2026-09"]?.opening?.leftover === 50,
  "Opening snapshot is leftover after close (100 − 50 absorbed)",
);
assert(
  closedOverspend.monthBudgets["2026-09"]?.opening?.envelopes.groceries === 0,
  "Opening snapshot is envelope available after close",
);

const blockedAssign = applyAssignLeftover(closedOverspend, "2026-08", [
  { categoryId: "rent", amount: 10 },
]);
assert(
  blockedAssign === closedOverspend,
  "Assign leftover is a no-op on a closed month",
);
assert(
  applyMoveMoney(closedOverspend, "2026-08", "rent", "groceries", 10) ===
    closedOverspend,
  "Move money is a no-op on a closed month",
);

const secondClose = applyMonthClose(closedOverspend, "2026-08", {
  now: new Date("2026-08-31T12:00:00.000Z"),
});
assert(secondClose === closedOverspend, "Closing twice is a no-op");

const future = canCloseMonth(august, "2026-12", new Date("2026-08-15T00:00:00.000Z"));
assert(future.ok === false, "A future month cannot be closed");

const negative = makePlan({
  transactions: [tx({ id: "in", date: "2026-08-01", amount: 50, type: "inflow" })],
  monthBudgets: { "2026-08": { assignments: { rent: 80 } } },
});
const negativeCheck = canCloseMonth(negative, "2026-08", new Date("2026-08-20"));
assert(negativeCheck.ok === false, "Negative leftover blocks close");

const skip = canCloseMonth(closedOverspend, "2026-10", new Date("2026-10-02"));
assert(skip.ok === false, "Must close months in order after the first close");
assert(
  canCloseMonth(closedOverspend, "2026-09", new Date("2026-09-02")).ok,
  "September can close after August",
);

const closedSept = applyMonthClose(closedOverspend, "2026-09", {
  now: new Date("2026-09-30T12:00:00.000Z"),
  closedAt: "2026-09-30T12:00:00.000Z",
});
assert(closedSept.closedThrough === "2026-09", "Second close advances closedThrough");
assert(
  closedSept.monthBudgets["2026-08"]?.closedAt === "2026-08-31T12:00:00.000Z",
  "Prior closedAt is preserved when the next month closes",
);

const legacyOverspend = {
  ...overspent,
} as BudgetData;
delete (legacyOverspend as { closedThrough?: string | null }).closedThrough;
assert(
  getAbsorbedCashOverspend(legacyOverspend, "2026-09") === 50,
  "Legacy plans still absorb cash overspend when viewing the next month",
);

const preview = previewMonthClose(august, "2026-08", new Date("2026-08-20"));
assert(preview.canClose, "August can close on a new plan");
assert(preview.leftover === 400, "Close preview leftover is 400");
assert(
  preview.envelopes.find((line) => line.id === "groceries")?.available === 120,
  "Close preview includes grocery available",
);

const empty = createEmptyBudgetPlan("Household");
assert(empty.closedThrough === null, "New plans start in explicit close mode");
assert(empty.accounts[0]?.name === "Spending", "New plans get one spending account");
assert(empty.accounts.length === 1, "New plans start with one account");

const normalized = normalizeBudgetPlan({
  ...empty,
  monthBudgets: {
    "2026-08": {
      assignments: { [empty.categories[0]!.id]: 25 },
      closedAt: "2026-08-31T00:00:00.000Z",
      opening: { leftover: 10, envelopes: { x: 5 } },
    },
  },
  closedThrough: "2026-08",
} as BudgetPlan);
assert(
  normalized.closedThrough === "2026-08",
  "Normalize keeps closedThrough",
);
assert(
  normalized.monthBudgets["2026-08"]?.closedAt === "2026-08-31T00:00:00.000Z",
  "Normalize keeps closedAt",
);
assert(
  normalized.monthBudgets["2026-08"]?.opening?.leftover === 10,
  "Normalize keeps opening leftover",
);

const { closedThrough: _ignored, ...withoutClose } = empty;
const omitted = normalizeBudgetPlan(withoutClose as BudgetPlan);
assert(
  !Object.hasOwn(omitted, "closedThrough"),
  "Normalize does not invent close state for plans that omit it",
);

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall month-close tests passed");
