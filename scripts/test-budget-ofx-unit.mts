/**
 * OFX 1.x SGML, OFX 2.x XML, and QFX import, plus re-import dedupe.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-ofx-unit.mts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getUnclearedTransactions } from "../src/lib/budget/accounts.ts";
import {
  parsedCsvToTransactionInput,
} from "../src/lib/budget/csv.ts";
import {
  describeOfxFormat,
  detectBudgetImportKind,
  parseBudgetOfx,
} from "../src/lib/budget/ofx.ts";
import { applyRulesToImportedTransactions } from "../src/lib/budget/payee-rules.ts";
import type {
  BudgetAccount,
  BudgetCategory,
  BudgetPlan,
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

const accounts: BudgetAccount[] = [
  { id: "acct-chequing", name: "Chequing", type: "chequing", sortOrder: 0 },
  { id: "acct-savings", name: "Savings", type: "savings", sortOrder: 1 },
  { id: "acct-card", name: "Visa", type: "credit-card", sortOrder: 2 },
];
const categories: BudgetCategory[] = [
  { id: "groceries", groupId: "g1", name: "Groceries", sortOrder: 0 },
];

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/lib/budget/fixtures",
);

function load(name: string): string {
  return readFileSync(join(fixtureDir, name), "utf8");
}

const options = {
  accounts,
  categories,
  existingTransactions: [] as BudgetTransaction[],
  fallbackAccountId: "acct-chequing",
  currency: "CAD" as const,
};

const ofx1 = load("sample-ofx-1.sgml.ofx");
assert(describeOfxFormat("sample-ofx-1.sgml.ofx", ofx1) === "OFX 1", "Labels SGML as OFX 1");
const ofx1Preview = parseBudgetOfx(ofx1, { ...options, fileName: "activity.ofx" });
assert(!ofx1Preview.error, "OFX 1 parses without a file error");
assert(ofx1Preview.formatLabel === "OFX 1", "OFX 1 preview names the format");
const payroll = ofx1Preview.imported.find((tx) => tx.payee === "Acme Payroll");
const grocery = ofx1Preview.imported.find((tx) => tx.payee === "Maple Grocery");
const cheque = ofx1Preview.imported.find((tx) => tx.payee === "Cheque payment");
const transfer = ofx1Preview.imported.find((tx) => tx.payee === "Transfer to Savings");
assert(
  payroll?.type === "inflow" && payroll.amount === 3200 && payroll.importId === "ofx:fit-payroll-1",
  "OFX 1 deposit is an inflow keyed by FITID",
);
assert(
  grocery?.type === "outflow" && grocery.amount === 84.5 && grocery.date === "2026-03-02",
  "OFX 1 negative TRNAMT is an outflow and DTPOSTED keeps the calendar date",
);
assert(
  cheque?.memo === "Cheque 1001" && cheque.amount === 40 && cheque.type === "outflow",
  "OFX 1 cheque number is kept on the memo",
);
assert(
  transfer?.type === "transfer" &&
    transfer.transferAccountId === "acct-savings" &&
    transfer.amount === 500,
  "OFX 1 transfer payee reconstructs onto the named on-budget account",
);
assert(
  ofx1Preview.skipped.some((row) => row.reason === "invalid-date") &&
    ofx1Preview.skipped.some((row) => row.reason === "currency-mismatch"),
  "OFX 1 skips an unparseable date and a USD amount on a CAD budget",
);
assert(ofx1Preview.imported.every((tx) => tx.cleared === false), "OFX rows stay uncleared for reconcile");

const ofx2 = load("sample-ofx-2.xml.ofx");
assert(describeOfxFormat("statement.ofx", ofx2) === "OFX 2", "Labels XML as OFX 2");
const ofx2Preview = parseBudgetOfx(ofx2, { ...options, fileName: "statement.ofx" });
assert(
  ofx2Preview.imported.length === 3 &&
    ofx2Preview.imported.some((tx) => tx.importId === "ofx:xml-grocery-1") &&
    ofx2Preview.imported.some((tx) => tx.payee === "Corner Cafe" && !tx.externalId),
  "OFX 2 XML reads closed tags, FITID, and a row with no FITID",
);

const qfx = load("sample-qfx.qfx");
assert(describeOfxFormat("card.qfx", qfx) === "QFX", "Labels QFX from the extension and INTU.BID");
const qfxPreview = parseBudgetOfx(qfx, {
  ...options,
  fileName: "card.qfx",
  fallbackAccountId: "acct-card",
});
assert(!qfxPreview.error, "QFX parses without a file error");
assert(
  qfxPreview.imported.find((tx) => tx.payee === "Corner Cafe" && tx.amount === 18)?.type ===
    "outflow",
  "QFX card purchase (negative TRNAMT) is an outflow",
);
assert(
  qfxPreview.imported.find((tx) => tx.payee === "Payment thank you")?.type === "inflow",
  "QFX card payment (positive TRNAMT) is an inflow",
);
const coffees = qfxPreview.imported.filter((tx) => tx.amount === 6);
assert(
  coffees.length === 2 && new Set(coffees.map((tx) => tx.importId)).size === 2,
  "Two same-day same-amount QFX rows with different FITIDs both import",
);

const reimport = parseBudgetOfx(ofx1, {
  ...options,
  fileName: "activity.ofx",
  existingTransactions: ofx1Preview.imported.map((row, index) => ({
    id: `saved-${index}`,
    date: row.date,
    payee: row.payee,
    amount: row.amount,
    accountId: row.accountId,
    type: row.type,
    importId: row.importId,
    transferAccountId: row.transferAccountId,
  })),
});
assert(
  reimport.imported.length === 0 && reimport.duplicates.length === ofx1Preview.imported.length,
  "Re-importing the same OFX file adds nothing",
);

const overlap = ofx2.replace(
  "</BANKTRANLIST>",
  `<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260309</DTPOSTED><TRNAMT>-15.00</TRNAMT><FITID>xml-new-1</FITID><NAME>New Shop</NAME></STMTTRN></BANKTRANLIST>`,
);
const overlapPreview = parseBudgetOfx(overlap, {
  ...options,
  fileName: "statement.ofx",
  existingTransactions: ofx2Preview.imported.map((row, index) => ({
    id: `xml-${index}`,
    date: row.date,
    payee: row.payee,
    amount: row.amount,
    accountId: row.accountId,
    type: row.type,
    importId: row.importId,
  })),
});
assert(
  overlapPreview.imported.length === 1 &&
    overlapPreview.imported[0]?.payee === "New Shop" &&
    overlapPreview.duplicates.length >= 2,
  "An overlapping OFX file imports only the new FITID",
);

const qfxAgain = parseBudgetOfx(qfx, {
  ...options,
  fileName: "card.qfx",
  fallbackAccountId: "acct-card",
  existingTransactions: qfxPreview.imported.map((row, index) => ({
    id: `qfx-${index}`,
    date: row.date,
    payee: row.payee,
    amount: row.amount,
    accountId: row.accountId,
    type: row.type,
    importId: row.importId,
  })),
});
assert(qfxAgain.imported.length === 0 && qfxAgain.duplicates.length === 4, "Re-importing the same QFX adds nothing");

const plaidExisting = [
  {
    id: "plaid-grocery",
    date: "2026-03-01",
    payee: "MAPLE GROCERY #100 TORONTO",
    amount: 84.5,
    accountId: "acct-chequing",
    type: "outflow" as const,
    importId: "plaid:txn-grocery",
  },
  {
    id: "plaid-rent",
    date: "2026-03-01",
    payee: "Landlord",
    amount: 84.5,
    accountId: "acct-chequing",
    type: "outflow" as const,
    importId: "plaid:txn-rent",
  },
];
const plaidOverlap = parseBudgetOfx(ofx1, {
  ...options,
  fileName: "activity.ofx",
  existingTransactions: plaidExisting,
});
assert(
  plaidOverlap.duplicates.some((tx) => tx.payee === "Maple Grocery") &&
    plaidOverlap.imported.every((tx) => tx.payee !== "Maple Grocery"),
  "A Plaid row with the same amount and a similar payee is not imported again",
);
assert(
  plaidOverlap.imported.some((tx) => tx.payee === "Acme Payroll"),
  "A different payee on a nearby date is not swallowed by the Plaid row",
);

const manual = parseBudgetOfx(ofx1, {
  ...options,
  fileName: "activity.ofx",
  existingTransactions: [
    {
      id: "manual-1",
      date: "2026-03-01",
      payee: "Groceries",
      amount: 84.5,
      accountId: "acct-chequing",
      type: "outflow",
    },
  ],
});
assert(
  manual.matched.some((tx) => tx.matchedTransactionId === "manual-1" && tx.payee === "Maple Grocery"),
  "OFX matches a hand-entered row on amount, account, and a close date",
);

const usdFile = ofx1.replace("<CURDEF>CAD", "<CURDEF>USD");
const usdPreview = parseBudgetOfx(usdFile, { ...options, fileName: "usd.ofx" });
assert(
  usdPreview.imported.length === 0 &&
    usdPreview.error === "This file is in USD and this budget is in CAD.",
  "A USD OFX file is rejected on a CAD budget",
);

assert(
  detectBudgetImportKind("statement.pdf", "not a statement").kind === "rejected",
  "A PDF is rejected with a file-type error",
);
assert(detectBudgetImportKind("activity.ofx", ofx1).kind === "ofx", "An .ofx file is OFX");
assert(
  detectBudgetImportKind("export.csv", "Date,Amount\n2026-03-01,1\n").kind === "csv",
  "A .csv file stays CSV",
);
const wrongOfx = detectBudgetImportKind("notes.ofx", "hello there");
assert(
  wrongOfx.kind === "rejected" &&
    wrongOfx.kind === "rejected" &&
    wrongOfx.error.includes("does not look like an OFX"),
  "An .ofx file that is not OFX explains the problem",
);

const groceryRow = ofx1Preview.imported.find((tx) => tx.payee === "Maple Grocery");
assert(Boolean(groceryRow), "Grocery row is available for payee rules");
if (groceryRow) {
  const input = parsedCsvToTransactionInput(groceryRow);
  const plan: BudgetPlan = {
    id: "plan",
    name: "Household",
    accounts,
    categoryGroups: [],
    categories,
    transactions: [],
    scheduledTransactions: [],
    monthBudgets: {},
    goals: [],
    payeeRules: [
      {
        id: "rule-grocery",
        match: "maple grocery",
        matchType: "contains",
        renameTo: "Groceries",
        categoryId: "groceries",
        priority: 0,
        enabled: true,
      },
    ],
    currency: "CAD",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  };
  const stored: BudgetTransaction = {
    id: "imp-grocery",
    date: input.date,
    payee: input.payee,
    accountId: input.accountId,
    categoryId: input.categoryId,
    amount: input.amount,
    type: input.type,
    cleared: input.cleared,
    memo: input.memo,
    approved: input.approved,
    importId: input.importId,
  };
  const next = applyRulesToImportedTransactions(plan, [stored], []);
  const saved = next.transactions[0];
  assert(
    saved?.payee === "Groceries" &&
      saved.originalPayee === "Maple Grocery" &&
      saved.categoryId === "groceries" &&
      saved.importId === "ofx:fit-grocery-1",
    "Confirming an OFX row runs payee rules",
  );
  assert(
    getUnclearedTransactions("acct-chequing", next.transactions).some(
      (tx) => tx.id === "imp-grocery",
    ),
    "The imported row is uncleared and shows up in reconcile",
  );
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall budget ofx unit checks passed");
