/**
 * Plaid → Budget mapping. No live Plaid calls.
 *   npx tsx --tsconfig tsconfig.json scripts/test-budget-plaid-unit.mts
 */
import {
  applyPlaidImport,
  formatLinkedAccountName,
  mapPlaidAccountType,
  plaidImportId,
  plaidSignedAmountToBudget,
  unlinkPlaidItemFromPlan,
} from "../src/lib/budget/plaid.ts";
import {
  isPlaidConfigured,
  parsePlaidEnv,
  readPlaidConfig,
} from "../src/lib/plaid/config.ts";
import { createEmptyBudgetPlan } from "../src/types/budget.ts";
import { PRIMARY_NAV_TITLES } from "../src/lib/chrome/nav.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(parsePlaidEnv(undefined) === "sandbox", "default env is sandbox");
assert(parsePlaidEnv("sandbox") === "sandbox", "sandbox stays sandbox");
assert(parsePlaidEnv("production") === "production", "production is accepted");
assert(readPlaidConfig() == null, "missing Plaid env is not configured");
assert(isPlaidConfigured() === false, "app runs without Plaid creds");

assert(plaidImportId("tx_1") === "plaid:tx_1", "import id is prefixed");
assert(
  plaidSignedAmountToBudget(12.5)?.type === "outflow",
  "positive Plaid amount is outflow",
);
assert(
  plaidSignedAmountToBudget(-40)?.type === "inflow",
  "negative Plaid amount is inflow",
);
assert(plaidSignedAmountToBudget(0) == null, "zero amount is skipped");
assert(mapPlaidAccountType("depository", "checking") === "chequing", "checking maps");
assert(mapPlaidAccountType("depository", "savings") === "savings", "savings maps");
assert(mapPlaidAccountType("credit", "credit card") === "credit-card", "card maps");
assert(
  formatLinkedAccountName("Chase Checking", "1234") === "Chase Checking ••1234",
  "mask is shown",
);

assert(
  PRIMARY_NAV_TITLES.join(",") === "Budget,Invest,Retire",
  "bank link is not a fourth pillar",
);

const plan = createEmptyBudgetPlan("Test");
const starterId = plan.accounts[0]!.id;
let ids = 0;
const result = applyPlaidImport(
  plan,
  {
    itemId: "item_1",
    institutionName: "Chase",
    syncedAt: "2026-09-12T00:00:00.000Z",
    accounts: [
      {
        plaidAccountId: "acc_1",
        name: "Checking",
        officialName: "Chase Checking",
        mask: "1234",
        type: "depository",
        subtype: "checking",
      },
    ],
    transactions: [
      {
        transactionId: "tx_coffee",
        plaidAccountId: "acc_1",
        date: "2026-09-01",
        name: "COFFEE SHOP",
        merchantName: "Coffee",
        amount: 4.5,
        pending: false,
      },
      {
        transactionId: "tx_pay",
        plaidAccountId: "acc_1",
        date: "2026-09-02",
        name: "PAYROLL",
        merchantName: "Work",
        amount: -2000,
        pending: false,
      },
    ],
  },
  () => `id-${(ids += 1)}`,
);

assert(result.createdAccounts === 0, "reuses the unused starter spending account");
assert(result.imported === 2, "two new inbox rows");
assert(result.next.accounts[0]!.id === starterId, "starter account id stays");
assert(result.next.accounts[0]!.plaidAccountId === "acc_1", "account is linked");
const coffee = result.next.transactions.find((tx) => tx.importId === "plaid:tx_coffee");
assert(coffee?.approved === false, "imported rows wait in the inbox");
assert(coffee?.type === "outflow", "coffee is outflow");
assert(coffee?.categoryId == null, "outflow stays uncategorized");
const pay = result.next.transactions.find((tx) => tx.importId === "plaid:tx_pay");
assert(pay?.type === "inflow", "payroll is inflow");

const again = applyPlaidImport(result.next, {
  itemId: "item_1",
  institutionName: "Chase",
  syncedAt: "2026-09-12T01:00:00.000Z",
  accounts: result.next.accounts.map((account) => ({
    plaidAccountId: account.plaidAccountId ?? "acc_1",
    name: account.name,
    officialName: null,
    mask: account.plaidMask ?? null,
    type: "depository",
    subtype: "checking",
  })),
  transactions: [
    {
      transactionId: "tx_coffee",
      plaidAccountId: "acc_1",
      date: "2026-09-01",
      name: "COFFEE SHOP",
      merchantName: "Coffee",
      amount: 4.5,
      pending: false,
    },
  ],
});
assert(again.duplicates === 1, "same Plaid id is skipped");
assert(again.imported === 0, "no second coffee");

const unlinked = unlinkPlaidItemFromPlan(result.next, "item_1");
assert(
  unlinked.accounts.every((account) => !account.plaidAccountId),
  "disconnect clears the link",
);
assert(unlinked.transactions.length === 2, "disconnect keeps the register");

const ui = readFileSync(
  join(process.cwd(), "src/components/budget/budget-bank-link.tsx"),
  "utf8",
);
assert(!/YNAB/i.test(ui), "bank link UI does not name YNAB");
assert(ui.includes("Connect bank"), "primary CTA is Connect bank");
assert(
  existsSync(join(process.cwd(), "supabase/migrations/013_user_plaid_items.sql")),
  "Plaid migration is checked in",
);

console.log("budget plaid unit tests passed");
