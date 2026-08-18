/**
 * Budget CSV import: parse, sign, skip bad rows, and dedup.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-csv-unit.mts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAccountBalance } from "../src/lib/budget/accounts.ts";
import { getReadyToAssign } from "../src/lib/budget/calculations.ts";
import {
  budgetImportDedupeKey,
  parseBudgetCsv,
  parseBudgetDate,
  parseBudgetMoney,
  parseCsvRows,
  parsedCsvToTransactionInput,
} from "../src/lib/budget/csv.ts";
import type { BudgetAccount, BudgetCategory, BudgetData } from "../src/types/budget.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

const accounts: BudgetAccount[] = [
  { id: "acct-chequing", name: "Chequing", type: "chequing", sortOrder: 0 },
  { id: "acct-savings", name: "Savings", type: "savings", sortOrder: 1 },
];
const categories: BudgetCategory[] = [
  { id: "groceries", groupId: "g1", name: "Groceries", sortOrder: 0 },
  { id: "dining", groupId: "g1", name: "Dining Out", sortOrder: 1 },
];

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/lib/budget/fixtures",
);

assert(parseBudgetMoney("$1,234.56") === 1234.56, "Parses currency and commas");
assert(parseBudgetMoney("(50.00)") === -50, "Parentheses are negative");
assert(parseBudgetMoney("-84") === -84, "Leading minus is negative");
assert(parseBudgetDate("2026-03-02") === "2026-03-02", "Parses ISO dates");
assert(parseBudgetDate("03/02/2026") === "2026-03-02", "Parses US dates");
assert(parseBudgetDate("2 Mar 2026") === "2026-03-02", "Parses named dates");
assert(parseBudgetDate("2026-13-40") === null, "Rejects impossible dates");

const quoted = parseCsvRows('Date,Description\n2026-03-02,"Whole Foods, Inc."\n');
assert(
  quoted[1]?.[1] === "Whole Foods, Inc.",
  "Keeps commas inside quoted payees",
);

const bankCsv = `Date,Description,Amount,Memo
2026-03-01,Acme Payroll,3200,March pay
2026-03-02,Whole Foods,-84,Weekly groceries
2026-03-03,Transfer to Savings,-500,
not-a-date,Bad Date,-10,
2026-03-05,Zero Dollar,0,
2026-03-06,,-12,
`;

const bankPreview = parseBudgetCsv(bankCsv, {
  accounts,
  categories,
  existingTransactions: [],
  fallbackAccountId: "acct-chequing",
});

assert(bankPreview.totalRows === 6, "Counts data rows including bad ones");
assert(bankPreview.inflowCount === 1, "Positive Amount is an inflow");
assert(bankPreview.outflowCount === 1, "Negative Amount that is not a known transfer is an outflow");
assert(bankPreview.transferCount === 1, "Transfer to a known on-budget account is reconstructed");
assert(bankPreview.inflowTotal === 3200, "Sums parsed inflows");
assert(bankPreview.outflowTotal === 84, "Sums leftover outflows after transfer reconstruction");
assert(
  bankPreview.imported.every((tx) => tx.accountId === "acct-chequing"),
  "Uses the destination account when the file has no Account column",
);
assert(
  bankPreview.skipped.some((row) => row.reason === "invalid-date") &&
    bankPreview.skipped.some((row) => row.reason === "zero-amount") &&
    bankPreview.skipped.some((row) => row.reason === "missing-payee"),
  "Skips bad date, zero amount, and missing payee with a count",
);
assert(bankPreview.skipped.length === 3, "Reports three skipped bad rows");
assert(
  bankPreview.imported.find((tx) => tx.payee === "Transfer to Savings")?.type ===
    "transfer" &&
    bankPreview.imported.find((tx) => tx.payee === "Transfer to Savings")
      ?.transferAccountId === "acct-savings",
  "Transfer to a known on-budget account imports as type transfer",
);

const leftoverTransfer = parseBudgetCsv(
  `Date,Description,Amount
2026-03-03,Transfer to External Wallet,-40
`,
  {
    accounts,
    categories,
    existingTransactions: [],
    fallbackAccountId: "acct-chequing",
  },
);
assert(
  leftoverTransfer.imported[0]?.type === "outflow" &&
    leftoverTransfer.imported[0]?.transferAccountId == null,
  "Transfer-like payees that do not name a known on-budget account stay inflow/outflow",
);

const debitCredit = parseBudgetCsv(
  `Date,Description,Debit,Credit
2026-04-01,Rent,1200,
2026-04-02,Paycheck,,3000
`,
  {
    accounts,
    categories,
    existingTransactions: [],
    fallbackAccountId: "acct-chequing",
  },
);
assert(
  debitCredit.imported[0]?.type === "outflow" &&
    debitCredit.imported[0]?.amount === 1200,
  "Debit column is an outflow",
);
assert(
  debitCredit.imported[1]?.type === "inflow" &&
    debitCredit.imported[1]?.amount === 3000,
  "Credit column is an inflow",
);

const ynabCsv = readFileSync(join(fixtureDir, "sample-ynab-export.csv"), "utf8");
const ynabPreview = parseBudgetCsv(ynabCsv, {
  accounts,
  categories,
  existingTransactions: [],
  fallbackAccountId: "acct-chequing",
});
assert(ynabPreview.imported.length === 4, "Parses the YNAB-ish fixture and collapses the transfer pair");
assert(
  ynabPreview.imported.find((tx) => tx.payee === "Whole Foods")?.categoryId ===
    "groceries",
  "Maps Category when it exactly matches an existing name",
);
assert(
  ynabPreview.imported.find((tx) => tx.payee === "Acme Payroll")?.categoryId ===
    null,
  "Does not invent a category for blank or unknown names",
);
assert(
  ynabPreview.imported.find((tx) => tx.payee === "Coffee Shop")?.categoryId ===
    "dining",
  "Matches Dining Out exactly",
);
const ynabTransfer = ynabPreview.imported.find((tx) => tx.type === "transfer");
assert(
  ynabTransfer?.accountId === "acct-chequing" &&
    ynabTransfer.transferAccountId === "acct-savings" &&
    ynabTransfer.amount === 500,
  "YNAB Transfer : Account pair reconstructs as one Chequing → Savings transfer",
);
assert(
  ynabPreview.imported.find((tx) => tx.payee === "Acme Payroll")?.accountId ===
    "acct-chequing",
  "Uses the Account column when the name matches",
);

const unknownCategory = parseBudgetCsv(
  `Date,Payee,Category,Outflow,Inflow
2026-05-01,Mystery,Brand New Category,10,0
`,
  {
    accounts,
    categories,
    existingTransactions: [],
    fallbackAccountId: "acct-chequing",
  },
);
assert(
  unknownCategory.imported[0]?.categoryId === null,
  "Does not create categories from unmatched CSV names",
);

const unknownAccount = parseBudgetCsv(
  `Account,Date,Payee,Amount
Hidden Vault,2026-05-02,Store,-20
`,
  {
    accounts,
    categories,
    existingTransactions: [],
    fallbackAccountId: "acct-chequing",
  },
);
assert(
  unknownAccount.imported.length === 0 &&
    unknownAccount.skipped[0]?.reason === "unknown-account",
  "Skips rows whose Account name does not match",
);

const existing = [
  {
    date: "2026-03-01",
    payee: "Acme Payroll",
    amount: 3200,
    accountId: "acct-chequing",
  },
];
const bankFixture = readFileSync(join(fixtureDir, "sample-bank-export.csv"), "utf8");
const dedupPreview = parseBudgetCsv(bankFixture, {
  accounts,
  categories,
  existingTransactions: existing,
  fallbackAccountId: "acct-chequing",
});
assert(
  !dedupPreview.imported.some((tx) => tx.payee === "Acme Payroll"),
  "Dedups against existing date + payee + amount + account",
);
assert(
  dedupPreview.duplicates.some((tx) => tx.payee === "Acme Payroll"),
  "Lists the existing-register match as a duplicate",
);

const withinFile = parseBudgetCsv(
  `Date,Description,Amount
2026-06-01,Coffee,-6
2026-06-01,Coffee,-6
`,
  {
    accounts,
    categories,
    existingTransactions: [],
    fallbackAccountId: "acct-chequing",
  },
);
assert(
  withinFile.imported.length === 1 && withinFile.duplicates.length === 1,
  "Dedups repeated rows inside the same file",
);
assert(
  budgetImportDedupeKey({
    date: "2026-06-01",
    payee: "Coffee",
    amount: 6,
    accountId: "acct-chequing",
  }) ===
    budgetImportDedupeKey({
      date: "2026-06-01",
      payee: "  coffee ",
      amount: 6.0,
      accountId: "acct-chequing",
    }),
  "Dedup key normalizes payee case/space and amount",
);

const applied = bankPreview.imported.map((row, index) => ({
  id: `imp-${index}`,
  ...parsedCsvToTransactionInput(row),
  categoryId: row.type === "inflow" ? null : row.categoryId,
}));
const budget: BudgetData = {
  categoryGroups: [{ id: "g1", name: "Living", sortOrder: 0 }],
  categories,
  transactions: applied,
  monthBudgets: {},
  goals: [],
  updatedAt: "2026-03-06T00:00:00.000Z",
};
assert(
  getReadyToAssign(budget, "2026-03") === 3200,
  "Imported inflows increase Ready to Assign; outflows do not",
);
assert(
  getAccountBalance(accounts[0], applied) === 3200 - 84 - 500,
  "Imported signed amounts update the destination account balance",
);

const oppositePair = parseBudgetCsv(
  `Account,Date,Payee,Amount
Chequing,2026-07-01,Move cash,-250
Savings,2026-07-01,Move cash,250
`,
  {
    accounts,
    categories,
    existingTransactions: [],
  },
);
const oppositeTransfer = oppositePair.imported.find((tx) => tx.type === "transfer");
assert(
  oppositePair.imported.length === 1 &&
    oppositeTransfer?.accountId === "acct-chequing" &&
    oppositeTransfer.transferAccountId === "acct-savings" &&
    oppositeTransfer.amount === 250,
  "A unique same-date opposite pair between known on-budget accounts reconstructs as one transfer",
);

const leftoverOpposite = parseBudgetCsv(
  `Account,Date,Payee,Amount
Chequing,2026-07-02,Cafe,-12
Savings,2026-07-02,Interest,12
Chequing,2026-07-02,Refund,12
`,
  {
    accounts,
    categories,
    existingTransactions: [],
  },
);
assert(
  leftoverOpposite.imported.every((tx) => tx.type !== "transfer") &&
    leftoverOpposite.imported.length === 3,
  "Ambiguous same-date equal amounts are not guessed into a transfer",
);

const existingTransfer = [
  {
    date: "2026-03-03",
    payee: "Transfer to Savings",
    amount: 500,
    accountId: "acct-chequing",
    type: "transfer" as const,
    transferAccountId: "acct-savings",
  },
];
const transferDup = parseBudgetCsv(
  `Date,Description,Amount
2026-03-03,Transfer to Savings,-500
`,
  {
    accounts,
    categories,
    existingTransactions: existingTransfer,
    fallbackAccountId: "acct-chequing",
  },
);
assert(
  transferDup.duplicates.length === 1 && transferDup.imported.length === 0,
  "Exact reconstructed transfer is still skipped as a duplicate",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall budget csv unit checks passed");
