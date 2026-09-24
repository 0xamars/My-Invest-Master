/**
 * Payee rules: match, priority, import paths, and card-envelope math.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-payee-rules-unit.mts
 */
import { getCategoryAvailable, getReadyToAssign } from "../src/lib/budget/calculations.ts";
import { paymentCategoryForAccount } from "../src/lib/budget/credit-card-payments.ts";
import { parseBudgetCsv, parsedCsvToTransactionInput } from "../src/lib/budget/csv.ts";
import { normalizeBudgetPlan } from "../src/lib/budget/migrate-plan.ts";
import {
  addPayeeRule,
  applyPayeeRuleToExisting,
  applyPayeeRulesToTransaction,
  applyRulesToImportedTransactions,
  countPayeeRuleMatches,
  firstMatchingPayeeRule,
  mergePayees,
  payeeRuleMatches,
  reorderPayeeRule,
} from "../src/lib/budget/payee-rules.ts";
import { applyPlaidImport } from "../src/lib/budget/plaid.ts";
import type {
  BudgetAccount,
  BudgetPlan,
  BudgetTransaction,
  PayeeRule,
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
const creditCard: BudgetAccount = {
  id: "acct-cc",
  name: "Visa",
  type: "credit-card",
  onBudget: true,
  sortOrder: 1,
};

function rule(partial: Partial<PayeeRule> & Pick<PayeeRule, "id" | "match">): PayeeRule {
  return {
    matchType: "contains",
    renameTo: "Amazon",
    priority: 0,
    enabled: true,
    ...partial,
  };
}

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

const amazon = rule({ id: "amazon", match: "AMZN", categoryId: "groceries", priority: 1 });
const hortons = rule({
  id: "hortons",
  match: "TIM HORTONS",
  matchType: "starts-with",
  renameTo: "Tim Hortons",
  categoryId: "dining",
  priority: 0,
});
const exact = rule({
  id: "exact",
  match: "AMZN MKTP CA*2K4X91",
  matchType: "exact",
  renameTo: "Amazon Exact",
  categoryId: "dining",
  priority: 2,
});

assert(payeeRuleMatches(amazon, "amzn mktp ca*2k4x91"), "Contains is case-insensitive");
assert(
  payeeRuleMatches(hortons, "TIM HORTONS #4471 BRAMPTON"),
  "Starts with ignores case and trailing store text",
);
assert(
  payeeRuleMatches(exact, "AMZN MKTP CA*2K4X91"),
  "Exact matches the full imported payee",
);
assert(!payeeRuleMatches(exact, "AMZN MKTP CA*OTHER"), "Exact does not match a different suffix");
assert(
  !payeeRuleMatches({ ...amazon, enabled: false }, "AMZN MKTP"),
  "Disabled rules do not match",
);
assert(
  firstMatchingPayeeRule([amazon, exact], "AMZN MKTP CA*2K4X91")?.id === "amazon",
  "Lower priority number wins over a later exact rule",
);
assert(
  firstMatchingPayeeRule(
    [rule({ id: "later", match: "AMZN", priority: 5, renameTo: "Later" }), amazon],
    "AMZN MKTP",
  )?.renameTo === "Amazon",
  "Priority is the number, not the array position",
);

const history = [
  tx({
    id: "old-amazon",
    date: "2026-01-01",
    amount: 10,
    type: "outflow",
    payee: "Amazon",
    categoryId: "groceries",
  }),
];

const renamed = applyPayeeRulesToTransaction(
  tx({
    id: "new",
    date: "2026-01-04",
    amount: 20,
    type: "outflow",
    payee: "AMZN MKTP CA*2K4X91",
  }),
  [rule({ id: "rename-only", match: "AMZN", renameTo: "Amazon" })],
  history,
  { recordOriginal: true, categories: makePlan().categories },
);
assert(renamed.payee === "Amazon", "Rule renames the imported payee");
assert(
  renamed.originalPayee === "AMZN MKTP CA*2K4X91",
  "Original imported payee is kept",
);
assert(
  renamed.categoryId === "groceries" && renamed.categoryManual === false,
  "No rule category falls back to the last-used category of the cleaned payee",
);

const noRule = applyPayeeRulesToTransaction(
  tx({
    id: "foods",
    date: "2026-01-04",
    amount: 12,
    type: "outflow",
    payee: "Whole Foods",
  }),
  [],
  [
    tx({
      id: "old-foods",
      date: "2026-01-01",
      amount: 8,
      type: "outflow",
      payee: "Whole Foods",
      categoryId: "groceries",
    }),
  ],
  { recordOriginal: true, categories: makePlan().categories },
);
assert(
  noRule.categoryId === "groceries",
  "Last-used category still applies when no rule matches",
);

const manual = tx({
  id: "manual",
  date: "2026-01-03",
  amount: 15,
  type: "outflow",
  payee: "AMZN MKTP CA*2K4X91",
  categoryId: "dining",
  categoryManual: true,
});
const planWithManual = makePlan({
  transactions: [manual],
  payeeRules: [amazon],
});
const appliedManual = applyPayeeRuleToExisting(planWithManual, "amazon");
assert(appliedManual.categorized === 0, "Apply-to-existing does not count a manual category");
assert(
  appliedManual.plan.transactions[0]?.categoryId === "dining",
  "A category the user set is not overwritten",
);
assert(
  appliedManual.plan.transactions[0]?.payee === "Amazon",
  "Apply-to-existing still renames the payee",
);

const split = tx({
  id: "split",
  date: "2026-01-03",
  amount: 30,
  type: "outflow",
  payee: "AMZN MKTP",
  categoryId: null,
  splits: [
    { id: "a", categoryId: "dining", amount: 10 },
    { id: "b", categoryId: null, amount: 20 },
  ],
});
const appliedSplit = applyPayeeRuleToExisting(
  makePlan({ transactions: [split], payeeRules: [amazon] }),
  "amazon",
);
assert(appliedSplit.categorized === 0, "Splits are not categorized by the rule");
assert(
  appliedSplit.plan.transactions[0]?.splits?.[0]?.categoryId === "dining" &&
    appliedSplit.plan.transactions[0]?.splits?.[1]?.categoryId == null,
  "Split lines stay as the user left them",
);
assert(appliedSplit.plan.transactions[0]?.payee === "Amazon", "Split payee is still renamed");

const transfer = tx({
  id: "xfer",
  date: "2026-01-03",
  amount: 40,
  type: "transfer",
  payee: "AMZN transfer",
  transferAccountId: creditCard.id,
  categoryId: null,
});
const appliedTransfer = applyPayeeRuleToExisting(
  makePlan({
    transactions: [transfer],
    payeeRules: [rule({ id: "amazon", match: "AMZN", categoryId: "groceries" })],
  }),
  "amazon",
);
assert(
  appliedTransfer.plan.transactions[0]?.categoryId == null &&
    appliedTransfer.categorized === 0,
  "Transfers are not categorized by the rule",
);

const uncategorized = tx({
  id: "open",
  date: "2026-01-05",
  amount: 9,
  type: "outflow",
  payee: "AMZN MKTP",
  memo: "keep me",
});
const appliedOpen = applyPayeeRuleToExisting(
  makePlan({
    transactions: [uncategorized],
    payeeRules: [rule({ ...amazon, memo: "from rule" })],
  }),
  "amazon",
);
assert(appliedOpen.categorized === 1, "Uncategorized rows get the rule category");
assert(
  appliedOpen.plan.transactions[0]?.categoryId === "groceries",
  "Apply-to-existing assigns the rule category",
);
assert(
  appliedOpen.plan.transactions[0]?.memo === "keep me",
  "An existing memo is not replaced",
);
assert(
  addPayeeRule(makePlan(), amazon, { applyToExisting: false }).transactions.length === 0,
  "Creating a rule does not touch history unless asked",
);

const cardPlan = makePlan({
  transactions: [
    tx({ id: "in", date: "2026-01-02", amount: 500, type: "inflow", payee: "Pay" }),
    tx({
      id: "charge",
      date: "2026-01-08",
      amount: 80,
      type: "outflow",
      accountId: creditCard.id,
      payee: "AMZN MKTP CA*2K4X91",
      categoryId: null,
    }),
  ],
  monthBudgets: { "2026-01": { assignments: { groceries: 200 } } },
  payeeRules: [amazon],
});
const payment = paymentCategoryForAccount(cardPlan.categories, creditCard.id);
assert(payment != null, "Card has a payment category");
const paymentId = payment?.id ?? "";
assert(
  getCategoryAvailable(cardPlan, paymentId, "2026-01") === 0,
  "Uncategorized card charge does not fund the payment envelope",
);
const cardApplied = applyPayeeRuleToExisting(cardPlan, "amazon").plan;
assert(
  getCategoryAvailable(cardApplied, "groceries", "2026-01") === 120,
  "Categorizing the card charge spends the groceries envelope (200 − 80)",
);
assert(
  getCategoryAvailable(cardApplied, paymentId, "2026-01") === 80,
  "Categorizing the card charge funds the card payment envelope",
);
assert(
  getReadyToAssign(cardApplied, "2026-01") === 300,
  "Card categorization does not change leftover",
);

const csvPlan = makePlan({ payeeRules: [amazon, hortons] });
const csv = parseBudgetCsv(
  `Date,Description,Amount
2026-03-02,AMZN MKTP CA*2K4X91,-42
2026-03-03,TIM HORTONS #4471 BRAMPTON,-6.50
`,
  {
    accounts: csvPlan.accounts,
    categories: csvPlan.categories,
    existingTransactions: [],
    fallbackAccountId: chequing.id,
  },
);
const imported = applyRulesToImportedTransactions(
  csvPlan,
  csv.imported.map((row, index) => {
    const input = parsedCsvToTransactionInput(row);
    return tx({
      id: `csv-${index}`,
      date: input.date,
      amount: input.amount,
      type: input.type,
      payee: input.payee,
      accountId: input.accountId,
      categoryId: input.categoryId,
      memo: input.memo,
      importId: input.importId,
      approved: false,
      cleared: "cleared",
    });
  }),
  [],
);
const csvAmazon = imported.transactions.find((row) => row.id === "csv-0");
const csvCoffee = imported.transactions.find((row) => row.id === "csv-1");
assert(
  csvAmazon?.payee === "Amazon" &&
    csvAmazon.originalPayee === "AMZN MKTP CA*2K4X91" &&
    csvAmazon.categoryId === "groceries",
  "CSV import renames, stores the bank payee, and categorizes",
);
assert(
  csvCoffee?.payee === "Tim Hortons" && csvCoffee.categoryId === "dining",
  "CSV import applies a starts-with rule",
);

const fileCategory = parseBudgetCsv(
  `Date,Description,Amount,Category
2026-03-04,AMZN MKTP,-5,Dining
`,
  {
    accounts: csvPlan.accounts,
    categories: csvPlan.categories,
    existingTransactions: [],
    fallbackAccountId: chequing.id,
  },
);
const keptFile = applyRulesToImportedTransactions(
  csvPlan,
  fileCategory.imported.map((row) => {
    const input = parsedCsvToTransactionInput(row);
    return tx({
      id: "csv-file",
      date: input.date,
      amount: input.amount,
      type: input.type,
      payee: input.payee,
      accountId: input.accountId,
      categoryId: input.categoryId,
      importId: input.importId,
    });
  }),
  [],
);
assert(
  keptFile.transactions.find((row) => row.id === "csv-file")?.categoryId === "dining" &&
    keptFile.transactions.find((row) => row.id === "csv-file")?.payee === "Amazon",
  "A category already on the CSV row is kept while the payee is still renamed",
);

let ids = 0;
const plaidPlan = makePlan({
  accounts: [chequing, { ...creditCard, plaidAccountId: "acc_cc", plaidItemId: "item_1" }],
  payeeRules: [amazon],
  transactions: [
    tx({
      id: "entered",
      date: "2026-03-01",
      amount: 18,
      type: "outflow",
      payee: "Corner store",
      accountId: creditCard.id,
      categoryId: "dining",
      categoryManual: true,
    }),
  ],
});
const plaid = applyPlaidImport(
  plaidPlan,
  {
    itemId: "item_1",
    institutionName: "Bank",
    syncedAt: "2026-03-05T00:00:00.000Z",
    accounts: [
      {
        plaidAccountId: "acc_cc",
        name: "Visa",
        officialName: null,
        mask: "4242",
        type: "credit",
        subtype: "credit card",
      },
    ],
    transactions: [
      {
        transactionId: "tx_amzn",
        plaidAccountId: "acc_cc",
        date: "2026-03-02",
        name: "AMZN MKTP CA*2K4X91",
        merchantName: null,
        amount: 22,
        pending: false,
      },
      {
        transactionId: "tx_match",
        plaidAccountId: "acc_cc",
        date: "2026-03-01",
        name: "AMZN MKTP CA*MATCH",
        merchantName: null,
        amount: 18,
        pending: false,
      },
    ],
  },
  () => `plaid-${(ids += 1)}`,
);
const plaidAmazon = plaid.next.transactions.find((row) => row.importId === "plaid:tx_amzn");
const plaidMatched = plaid.next.transactions.find((row) => row.id === "entered");
assert(
  plaidAmazon?.payee === "Amazon" &&
    plaidAmazon.originalPayee === "AMZN MKTP CA*2K4X91" &&
    plaidAmazon.categoryId === "groceries",
  "Plaid sync applies the payee rule to a new row",
);
assert(plaid.matched === 1, "Plaid matches the entered row");
assert(
  plaidMatched?.categoryId === "dining" && plaidMatched.categoryManual === true,
  "Plaid match does not overwrite a category the user set",
);

const counted = countPayeeRuleMatches(
  [tx({ id: "1", date: "2026-01-01", amount: 1, type: "outflow", payee: "AMZN X" })],
  amazon,
);
assert(counted === 1, "Preview counts existing transactions the pattern matches");

const reordered = reorderPayeeRule(
  makePlan({ payeeRules: [hortons, amazon] }),
  "amazon",
  "up",
);
assert(
  reordered.payeeRules?.[0]?.id === "amazon" && reordered.payeeRules[0]?.priority === 0,
  "Moving a rule earlier gives it first priority",
);

const merged = mergePayees(
  makePlan({
    transactions: [
      tx({ id: "a", date: "2026-01-01", amount: 4, type: "outflow", payee: "AMZN MKTP" }),
      tx({
        id: "b",
        date: "2026-01-02",
        amount: 5,
        type: "outflow",
        payee: "Amazon",
        categoryId: "groceries",
      }),
    ],
    scheduledTransactions: [
      {
        id: "sched",
        nextDate: "2026-02-01",
        frequency: "monthly",
        payee: "AMZN MKTP",
        accountId: chequing.id,
        categoryId: null,
        amount: 4,
        type: "outflow",
      },
    ],
  }),
  "AMZN MKTP",
  "Amazon",
  () => "merge-rule",
);
assert(
  merged.transactions.every((row) => row.payee === "Amazon"),
  "Merge moves transactions onto the kept payee",
);
assert(
  merged.transactions.find((row) => row.id === "a")?.originalPayee === "AMZN MKTP",
  "Merge remembers the old payee text",
);
assert(
  merged.payeeRules?.some(
    (entry) => entry.match === "AMZN MKTP" && entry.renameTo === "Amazon" && entry.matchType === "exact",
  ),
  "Merge creates an exact rename rule",
);
assert(
  merged.scheduledTransactions?.[0]?.payee === "Amazon",
  "Merge updates a scheduled payee with the same name",
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("budget payee rules unit tests passed");
