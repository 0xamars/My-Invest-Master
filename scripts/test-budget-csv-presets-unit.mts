/**
 * Canadian bank CSV presets and re-import dedupe.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-csv-presets-unit.mts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBudgetCsv, parseBudgetDate } from "../src/lib/budget/csv.ts";
import type { BudgetAccount, BudgetCategory } from "../src/types/budget.ts";

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
  { id: "acct-card", name: "Visa", type: "credit-card", sortOrder: 1 },
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

function parse(name: string, accountId = "acct-chequing") {
  return parseBudgetCsv(load(name), {
    accounts,
    categories,
    existingTransactions: [],
    fallbackAccountId: accountId,
    currency: "CAD",
  });
}

assert(parseBudgetDate("02/03/2026", "dmy") === "2026-03-02", "Day-first slash dates read as March 2");
assert(parseBudgetDate("02/03/2026") === "2026-02-03", "Default slash dates stay month-first");
assert(parseBudgetDate("13/03/2026") === "2026-03-13", "An impossible month falls back to day-first");

const rbc = parse("sample-rbc.csv");
assert(rbc.presetId === "rbc" && !rbc.error, "Auto-detects RBC from CAD$ and Description columns");
assert(
  rbc.imported.find((tx) => tx.payee.includes("Maple Grocery"))?.type === "outflow" &&
    rbc.imported.find((tx) => tx.payee.includes("Maple Grocery"))?.amount === 84.5 &&
    rbc.imported.find((tx) => tx.payee.includes("Maple Grocery"))?.payee.includes("Toronto") ===
      true,
  "RBC joins description columns and treats a negative CAD$ as money out",
);
assert(
  rbc.imported.find((tx) => tx.payee === "Acme Payroll")?.type === "inflow" &&
    rbc.imported.find((tx) => tx.payee === "Acme Payroll")?.date === "2026-03-01",
  "RBC dates are month/day/year and deposits are inflows",
);
assert(
  rbc.imported.find((tx) => tx.payee === "Cheque payment")?.memo === "Cheque 1001",
  "RBC cheque number is kept on the memo",
);
assert(
  rbc.skipped.some((row) => row.reason === "currency-mismatch") &&
    rbc.imported.every((tx) => tx.payee !== "Foreign Shop"),
  "An RBC USD-only row is skipped on a CAD budget",
);
assert(
  rbc.formatNote?.includes("activity CSV") === true,
  "RBC note records the activity-download sign",
);

const td = parse("sample-td.csv");
assert(td.presetId === "td", "Auto-detects TD withdrawals and deposits");
assert(
  td.imported.find((tx) => tx.payee === "Maple Grocery")?.type === "outflow" &&
    td.imported.find((tx) => tx.payee === "Acme Payroll")?.type === "inflow" &&
    td.imported.find((tx) => tx.payee === "Maple Grocery")?.date === "2026-03-02",
  "TD withdrawals are outflows, deposits are inflows, dates are month/day/year",
);
assert(
  td.skipped.some((row) => row.reason === "invalid-date"),
  "TD skips a row whose date cannot be parsed",
);

const scotia = parse("sample-scotiabank.csv");
assert(scotia.presetId === "scotiabank", "Auto-detects Scotiabank singular Withdrawal and Deposit");
assert(
  scotia.imported.find((tx) => tx.payee === "Maple Grocery")?.date === "2026-03-02" &&
    scotia.imported.find((tx) => tx.payee === "Acme Payroll")?.date === "2026-03-01" &&
    scotia.imported.find((tx) => tx.payee === "Maple Grocery")?.type === "outflow",
  "Scotiabank slash dates are day/month/year and withdrawals leave the account",
);
assert(
  scotia.formatNote?.includes("do not publish one date mask") === true,
  "Scotiabank note says the date mask is not published",
);

const bmo = parse("sample-bmo.csv");
assert(bmo.presetId === "bmo", "Auto-detects BMO Date Posted and Transaction Amount");
assert(
  bmo.imported.find((tx) => tx.payee === "Maple Grocery")?.type === "outflow" &&
    bmo.imported.find((tx) => tx.payee === "Maple Grocery")?.date === "2026-03-02" &&
    bmo.imported.find((tx) => tx.payee === "Acme Payroll")?.type === "inflow",
  "BMO Debit is money out and Credit is money in",
);

const cibc = parse("sample-cibc.csv");
assert(cibc.presetId === "cibc", "Auto-detects CIBC transaction date with withdrawals and deposits");
assert(
  cibc.imported.find((tx) => tx.payee === "Maple Grocery")?.type === "outflow" &&
    cibc.imported.find((tx) => tx.payee === "Acme Payroll")?.type === "inflow" &&
    cibc.imported.find((tx) => tx.payee === "Maple Grocery")?.date === "2026-03-02",
  "CIBC year-month-day withdrawals and deposits keep their direction",
);

const headerless = parse("sample-cibc-headerless.csv");
assert(
  headerless.presetId === "cibc" &&
    headerless.imported.length === 2 &&
    headerless.imported.find((tx) => tx.payee === "Maple Grocery")?.type === "outflow",
  "Headerless CIBC rows use date, description, withdrawal, deposit",
);

const tangerine = parse("sample-tangerine.csv");
assert(tangerine.presetId === "tangerine", "Auto-detects Tangerine Date, Transaction, Name");
assert(
  tangerine.imported.find((tx) => tx.payee === "Maple Grocery")?.type === "outflow" &&
    tangerine.imported.find((tx) => tx.payee === "Acme Payroll")?.type === "inflow" &&
    tangerine.imported.find((tx) => tx.payee === "Interac Network Usage Charge")?.date ===
      "2026-12-10",
  "Tangerine uses Name as the payee and month-first dates, including 12-10-2026",
);
assert(
  tangerine.imported.every((tx) => tx.payee !== "DEBIT" && tx.payee !== "FEE"),
  "Tangerine Transaction column stays a type code",
);
assert(
  tangerine.formatNote?.includes("does not list columns") === true,
  "Tangerine note says the column list is not published",
);

const eqAuto = parse("sample-eq-bank.csv");
assert(
  eqAuto.imported.find((tx) => tx.payee === "Interac e-Transfer sent")?.type === "outflow" &&
    eqAuto.imported.find((tx) => tx.payee === "Interest paid")?.type === "inflow",
  "EQ Bank signed amounts parse when the columns look generic",
);
const eq = parseBudgetCsv(load("sample-eq-bank.csv"), {
  accounts,
  categories,
  existingTransactions: [],
  fallbackAccountId: "acct-chequing",
  currency: "CAD",
  preset: "eq-bank",
});
assert(
  eq.presetId === "eq-bank" && eq.formatNote?.includes("do not publish the columns") === true,
  "EQ Bank preset says its columns are not published",
);

const simplii = parse("sample-simplii.csv");
assert(simplii.presetId === "simplii", "Auto-detects Simplii Funds Out and Funds In");
assert(
  simplii.imported.find((tx) => tx.payee === "Maple Grocery")?.type === "outflow" &&
    simplii.imported.find((tx) => tx.payee === "Acme Payroll")?.type === "inflow",
  "Simplii Funds Out leaves the account and Funds In comes in",
);
assert(
  simplii.formatNote?.includes("not the column list") === true,
  "Simplii note says the column list is inferred from CIBC",
);

const card = parse("sample-credit-card.csv", "acct-card");
assert(card.presetId === "credit-card", "Auto-detects a posting-date card file");
assert(
  card.imported.find((tx) => tx.payee === "Maple Grocery")?.type === "outflow" &&
    card.imported.find((tx) => tx.payee === "Maple Grocery")?.date === "2026-03-02" &&
    card.imported.find((tx) => tx.payee === "Payment thank you")?.type === "inflow",
  "Card files treat a positive amount as a purchase and a negative amount as a payment",
);
assert(
  card.formatNote?.includes("not one issuer") === true,
  "Credit-card note says it is not one issuer’s published spec",
);

const usdPlan = parseBudgetCsv(load("sample-rbc.csv"), {
  accounts,
  categories,
  existingTransactions: [],
  fallbackAccountId: "acct-chequing",
  currency: "USD",
});
assert(
  usdPlan.imported.some((tx) => tx.payee.includes("Foreign Shop")) &&
    usdPlan.skipped.some((row) => row.reason === "currency-mismatch") &&
    usdPlan.imported.every((tx) => tx.payee !== "Acme Payroll"),
  "On a USD budget, RBC keeps the USD$ row and skips CAD-only rows",
);
const cadOnly = parseBudgetCsv(
  `Transaction Date,Description 1,CAD$
3/1/2026,Acme Payroll,10.00
`,
  {
    accounts,
    categories,
    existingTransactions: [],
    fallbackAccountId: "acct-chequing",
    currency: "USD",
  },
);
assert(
  cadOnly.error === "This file is in CAD and this budget is in USD.",
  "A CAD-only file is rejected on a USD budget",
);

const first = parse("sample-td.csv");
const second = parseBudgetCsv(load("sample-td.csv"), {
  accounts,
  categories,
  existingTransactions: first.imported.map((row, index) => ({
    id: `td-${index}`,
    date: row.date,
    payee: row.payee,
    amount: row.amount,
    accountId: row.accountId,
    type: row.type,
    importId: row.importId,
  })),
  fallbackAccountId: "acct-chequing",
  currency: "CAD",
});
assert(
  second.imported.length === 0 && second.duplicates.length === first.imported.length,
  "Re-importing the same CSV adds nothing",
);

const overlap = parseBudgetCsv(
  `Date,Description,Withdrawals,Deposits,Balance
03/02/2026,Maple Grocery,84.50,,
03/06/2026,New Shop,12.00,,
`,
  {
    accounts,
    categories,
    existingTransactions: first.imported.map((row, index) => ({
      id: `td-${index}`,
      date: row.date,
      payee: row.payee,
      amount: row.amount,
      accountId: row.accountId,
      type: row.type,
      importId: row.importId,
    })),
    fallbackAccountId: "acct-chequing",
    currency: "CAD",
  },
);
assert(
  overlap.imported.length === 1 &&
    overlap.imported[0]?.payee === "New Shop" &&
    overlap.duplicates.some((tx) => tx.payee === "Maple Grocery"),
  "An overlapping CSV imports only the new row",
);

const within = parseBudgetCsv(
  `Date,Description,Withdrawals,Deposits
03/02/2026,Maple Grocery,84.50,
03/02/2026,Maple Grocery,84.50,
`,
  {
    accounts,
    categories,
    existingTransactions: [],
    fallbackAccountId: "acct-chequing",
    currency: "CAD",
  },
);
assert(
  within.imported.length === 1 && within.duplicates.length === 1,
  "Repeated CSV rows inside one file collapse to one",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall budget csv preset checks passed");
