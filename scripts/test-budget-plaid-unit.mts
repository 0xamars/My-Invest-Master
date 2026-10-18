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
import { PLAID_LINK_COUNTRY_CODES } from "../src/lib/plaid/client.ts";
import { isBankConnectEnabled } from "../src/lib/plaid/feature.ts";
import {
  formatPlaidItemSyncLine,
  nextPlaidItemStatusAfterSyncFailure,
  parsePlaidWebhookBody,
  plaidErrorNeedsReconnect,
  plaidItemNeedsUserReconnect,
  resolvePlaidWebhookItemStatus,
} from "../src/lib/plaid/item-status.ts";
import { budgetPlanBaseForSync } from "../src/lib/budget/plan-save-queue.ts";
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
assert(isBankConnectEnabled({}) === false, "bank connect is off when unset");
assert(
  isBankConnectEnabled({ NEXT_PUBLIC_BANK_CONNECT_ENABLED: "1" }) === true,
  "the public flag turns bank connect on",
);
assert(
  isBankConnectEnabled({ BANK_CONNECT_ENABLED: "true" }) === true,
  "the server flag turns bank connect on",
);
assert(
  isBankConnectEnabled({
    NEXT_PUBLIC_BANK_CONNECT_ENABLED: "1",
    BANK_CONNECT_ENABLED: "0",
  }) === false,
  "an explicit server off switch wins",
);
assert(
  PLAID_LINK_COUNTRY_CODES.includes("US") &&
    PLAID_LINK_COUNTRY_CODES.includes("CA"),
  "Link offers the US and Canada",
);
const plaidClientSource = readFileSync(
  join(process.cwd(), "src/lib/plaid/client.ts"),
  "utf8",
);
assert(plaidClientSource.includes('from "plaid"'), "Plaid calls use the official SDK");

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

const ofxPlan = createEmptyBudgetPlan("Household");
const ofxAccountId = ofxPlan.accounts[0]!.id;
ofxPlan.accounts[0]!.plaidAccountId = "acc_1";
ofxPlan.accounts[0]!.plaidItemId = "item_1";
ofxPlan.transactions = [
  {
    id: "ofx-grocery",
    date: "2026-03-02",
    payee: "Maple Grocery",
    accountId: ofxAccountId,
    categoryId: null,
    amount: 84.5,
    type: "outflow",
    cleared: "cleared",
    approved: true,
    importId: "ofx:fit-grocery-1",
  },
  {
    id: "ofx-rent",
    date: "2026-03-02",
    payee: "Landlord",
    accountId: ofxAccountId,
    categoryId: null,
    amount: 84.5,
    type: "outflow",
    cleared: "cleared",
    approved: true,
    importId: "ofx:fit-rent-1",
  },
];
const ofxSync = applyPlaidImport(ofxPlan, {
  itemId: "item_1",
  institutionName: "Test Bank",
  syncedAt: "2026-03-03T00:00:00.000Z",
  accounts: [
    {
      plaidAccountId: "acc_1",
      name: "Checking",
      officialName: null,
      mask: "1234",
      type: "depository",
      subtype: "checking",
    },
  ],
  transactions: [
    {
      transactionId: "tx_grocery",
      plaidAccountId: "acc_1",
      date: "2026-03-02",
      name: "MAPLE GROCERY #100 TORONTO",
      merchantName: "Maple Grocery",
      amount: 84.5,
      pending: false,
    },
    {
      transactionId: "tx_payroll",
      plaidAccountId: "acc_1",
      date: "2026-03-01",
      name: "Acme Payroll",
      merchantName: "Acme Payroll",
      amount: -3200,
      pending: false,
    },
  ],
});
assert(ofxSync.duplicates === 1, "an OFX grocery row is not imported again from the bank");
assert(ofxSync.imported === 1, "a different bank row is still imported");
assert(
  ofxSync.next.transactions.some((tx) => tx.importId === "ofx:fit-grocery-1"),
  "the OFX row stays the budget transaction",
);
assert(
  !ofxSync.next.transactions.some((tx) => tx.importId === "plaid:tx_grocery"),
  "the matching bank row does not become a second transaction",
);
assert(
  ofxSync.next.transactions.some((tx) => tx.importId === "plaid:tx_payroll"),
  "payroll from the bank is a new transaction",
);

const csvPlan = createEmptyBudgetPlan("Household");
const csvAccountId = csvPlan.accounts[0]!.id;
csvPlan.accounts[0]!.plaidAccountId = "acc_csv";
csvPlan.accounts[0]!.plaidItemId = "item_csv";
csvPlan.transactions = [
  {
    id: "csv-coffee",
    date: "2026-04-02",
    payee: "Corner cafe",
    originalPayee: "Sandbox Coffee",
    accountId: csvAccountId,
    categoryId: "sandbox-dining",
    amount: 12,
    type: "outflow",
    cleared: "cleared",
    approved: true,
    importId: "csv:2026-04-02|sandbox coffee|1200|" + csvAccountId,
  },
  {
    id: "csv-other",
    date: "2026-04-02",
    payee: "Other Shop",
    accountId: csvAccountId,
    categoryId: null,
    amount: 12,
    type: "outflow",
    cleared: "cleared",
    approved: true,
    importId: "csv:2026-04-02|other shop|1200|" + csvAccountId,
  },
];
const edited = {
  ...csvPlan,
  transactions: csvPlan.transactions.map((tx) =>
    tx.id === "csv-coffee" ? { ...tx, memo: "Friday" } : tx,
  ),
};
const syncBase = budgetPlanBaseForSync(edited, csvPlan);
const csvSync = applyPlaidImport(syncBase!, {
  itemId: "item_csv",
  institutionName: "Sandbox Bank",
  syncedAt: "2026-04-03T00:00:00.000Z",
  accounts: [
    {
      plaidAccountId: "acc_csv",
      name: "Sandbox Checking",
      officialName: null,
      mask: "0000",
      type: "depository",
      subtype: "checking",
    },
  ],
  transactions: [
    {
      transactionId: "sandbox_tx_coffee",
      plaidAccountId: "acc_csv",
      date: "2026-04-02",
      name: "POS 9981",
      merchantName: "Sandbox Coffee",
      amount: 12,
      pending: false,
    },
    {
      transactionId: "sandbox_tx_bus",
      plaidAccountId: "acc_csv",
      date: "2026-04-03",
      name: "SANDBOX TRANSIT",
      merchantName: "Sandbox Transit",
      amount: 3.25,
      pending: false,
    },
  ],
});
assert(csvSync.duplicates === 1, "a CSV coffee row is not imported again from the bank");
assert(csvSync.imported === 1, "a bank row that is not in the file is still imported");
assert(
  csvSync.next.transactions.some((tx) => tx.id === "csv-coffee" && tx.memo === "Friday"),
  "bank sync keeps the edit that was waiting to save",
);
assert(
  !csvSync.next.transactions.some((tx) => tx.importId === "plaid:sandbox_tx_coffee"),
  "the matching CSV row does not become a second transaction",
);
assert(
  csvSync.next.transactions.some((tx) => tx.importId === "plaid:sandbox_tx_bus"),
  "transit from the bank is a new transaction",
);

const mapPlan = createEmptyBudgetPlan("Map");
const starterAccountId = mapPlan.accounts[0]!.id;
let mapIds = 0;
const created = applyPlaidImport(
  mapPlan,
  {
    itemId: "item_map",
    institutionName: "Test Bank",
    syncedAt: "2026-03-03T00:00:00.000Z",
    accounts: [
      {
        plaidAccountId: "acc_new",
        name: "Everyday",
        officialName: null,
        mask: "9999",
        type: "depository",
        subtype: "checking",
      },
    ],
    transactions: [],
  },
  () => `map-${(mapIds += 1)}`,
  [{ plaidAccountId: "acc_new", budgetAccountId: null }],
);
assert(created.createdAccounts === 1, "create choice adds a budget account");
assert(
  created.next.accounts[0]!.id === starterAccountId &&
    !created.next.accounts[0]!.plaidAccountId,
  "create choice does not take the existing account",
);
const linked = applyPlaidImport(
  mapPlan,
  {
    itemId: "item_map",
    institutionName: "Test Bank",
    syncedAt: "2026-03-03T00:00:00.000Z",
    accounts: [
      {
        plaidAccountId: "acc_new",
        name: "Everyday",
        officialName: null,
        mask: "9999",
        type: "depository",
        subtype: "checking",
      },
    ],
    transactions: [],
  },
  () => "unused",
  [{ plaidAccountId: "acc_new", budgetAccountId: starterAccountId }],
);
assert(linked.createdAccounts === 0, "picking an account does not create another");
assert(
  linked.next.accounts[0]!.plaidAccountId === "acc_new",
  "the chosen budget account is linked",
);

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
assert(ui.includes("status.enabled"), "connect bank follows the account flag");
assert(
  ui.includes("You can still disconnect"),
  "an existing bank can be disconnected when the flag is off",
);
assert(ui.includes("Sync now"), "sync action says Sync now");
assert(ui.includes("Create a new account"), "mapping can create a budget account");
assert(ui.includes("Reconnect"), "item errors offer Reconnect");
assert(ui.includes("Import a file instead"), "a failed connection can import a file");
assert(
  ui.includes("/transactions?import=1"),
  "import a file opens the register import",
);
assert(ui.includes("/api/plaid/reconnect"), "update mode does not re-exchange");
assert(
  existsSync(join(process.cwd(), "supabase/migrations/013_user_plaid_items.sql")),
  "Plaid migration is checked in",
);

assert(
  plaidErrorNeedsReconnect("ITEM_LOGIN_REQUIRED"),
  "login required needs reconnect",
);
assert(
  plaidErrorNeedsReconnect("USER_PERMISSION_REVOKED"),
  "revoked permission needs reconnect",
);
assert(!plaidErrorNeedsReconnect("RATE_LIMIT"), "rate limit is not reconnect");
assert(plaidItemNeedsUserReconnect("needs_reconnect"), "needs_reconnect is UI flag");
assert(plaidItemNeedsUserReconnect("error"), "error is UI flag");
assert(!plaidItemNeedsUserReconnect("active"), "active does not ask reconnect");

const loginWebhook = parsePlaidWebhookBody({
  item_id: "item_1",
  webhook_type: "ITEM",
  webhook_code: "ERROR",
  error: { error_code: "ITEM_LOGIN_REQUIRED" },
});
assert(loginWebhook.itemId === "item_1", "webhook parses item id");
assert(
  resolvePlaidWebhookItemStatus(loginWebhook) === "needs_reconnect",
  "ITEM ERROR + login required marks reconnect",
);
assert(
  resolvePlaidWebhookItemStatus({
    itemId: "item_1",
    webhookType: "ITEM",
    webhookCode: "LOGIN_REPAIRED",
    errorCode: null,
  }) === "active",
  "LOGIN_REPAIRED clears the flag",
);
assert(
  resolvePlaidWebhookItemStatus({
    itemId: "item_1",
    webhookType: "TRANSACTIONS",
    webhookCode: "DEFAULT_UPDATE",
    errorCode: null,
  }) === null,
  "transaction webhooks do not change status",
);
const reconnectLine = formatPlaidItemSyncLine({
  status: "needs_reconnect",
  lastSyncedAt: "2026-09-01T15:00:00.000Z",
});
assert(reconnectLine.includes("Last sync"), "reconnect still shows when it last synced");
assert(
  reconnectLine.toLowerCase().includes("reconnect"),
  "expired item copy asks to reconnect",
);
assert(
  !reconnectLine.toLowerCase().includes("sync failed"),
  "a sign-in expiry is not described as a generic failure",
);
const failedLine = formatPlaidItemSyncLine({
  status: "error",
  lastSyncedAt: "2026-09-01T15:00:00.000Z",
});
assert(failedLine.includes("Last sync"), "a failed connection still shows when it last synced");
assert(failedLine.toLowerCase().includes("sync failed"), "a failed sync says it failed");
assert(
  !failedLine.toLowerCase().includes("sign-in expired"),
  "a failed sync does not claim the sign-in expired",
);
assert(
  nextPlaidItemStatusAfterSyncFailure("active", "ITEM_LOGIN_REQUIRED") ===
    "needs_reconnect",
  "a login error marks reconnect",
);
assert(
  nextPlaidItemStatusAfterSyncFailure("active", "RATE_LIMIT") === "error",
  "a non-login sync error marks failure",
);
assert(
  nextPlaidItemStatusAfterSyncFailure("needs_reconnect", "RATE_LIMIT") ===
    "needs_reconnect",
  "a later non-login error does not clear sign-in expiry",
);
const syncRoute = readFileSync(
  join(process.cwd(), "src/app/api/plaid/sync/route.ts"),
  "utf8",
);
assert(
  syncRoute.includes("nextPlaidItemStatusAfterSyncFailure"),
  "a failed sync stores the connection state",
);
const register = readFileSync(
  join(process.cwd(), "src/components/budget/budget-transactions-content.tsx"),
  "utf8",
);
assert(
  register.includes('searchParams.get("import")') && register.includes("setImportOpen(true)"),
  "the register opens file import from the bank connection",
);

const webhookRoute = readFileSync(
  join(process.cwd(), "src/app/api/plaid/webhook/route.ts"),
  "utf8",
);
assert(
  webhookRoute.includes("resolvePlaidWebhookItemStatus") &&
    webhookRoute.includes("markPlaidItemStatus"),
  "webhook route writes reconnect status",
);

const settingsPage = readFileSync(
  join(process.cwd(), "src/app/settings/page.tsx"),
  "utf8",
);
assert(
  settingsPage.includes("DisplayCurrencyCard"),
  "settings includes display currency",
);
assert(
  !settingsPage.includes("MoneyProfile"),
  "settings has no Money Profile surface",
);

const appShell = readFileSync(
  join(process.cwd(), "src/components/layout/app-shell.tsx"),
  "utf8",
);
assert(!appShell.includes("AppSidebar"), "signed-in chrome has no leftover sidebar");
assert(
  appShell.includes("SignedInHeaderNav"),
  "signed-in chrome keeps Budget / Invest / Retire in the header",
);

const retireHome = readFileSync(
  join(process.cwd(), "src/components/retire/retire-home-content.tsx"),
  "utf8",
);
assert(
  retireHome.includes("Assign leftover") || retireHome.includes("leftoverLabel"),
  "Retire empty points at leftover",
);
assert(!retireHome.includes("FREEDOM_EMPTY.learnHref"), "Retire empty has no Learn self-link");
assert(!retireHome.includes("Open Retire"), "Retire empty has no self-link");
assert(!retireHome.includes(">Freedom<"), "Retire home does not label Freedom");
assert(!retireHome.includes("BrandStill"), "Retire empty has no decorative still");

const budgetHome = readFileSync(
  join(process.cwd(), "src/components/budget/budget-plans-list-content.tsx"),
  "utf8",
);
assert(budgetHome.includes("kitLabel"), "Budget empty keeps the starter-kit action");
assert(!budgetHome.includes("learnLabel"), "Budget empty has no Open Budget self-link");
assert(!budgetHome.includes("BrandStill"), "Budget empty has no decorative still");
assert(
  !budgetHome.includes("STARTER_ENVELOPE_NAMES"),
  "Budget empty does not render envelope chrome cards",
);

const investHome = readFileSync(
  join(process.cwd(), "src/components/invest/invest-home-content.tsx"),
  "utf8",
);
assert(!investHome.includes("BrandStill"), "Invest empty has no decorative still");

const firstBook = readFileSync(
  join(process.cwd(), "src/components/journey/first-book-wizard.tsx"),
  "utf8",
);
assert(firstBook.includes("Create portfolio"), "first book keeps the create action");
assert(!firstBook.includes("learnLabel"), "first book has no Open Invest self-link");
assert(!firstBook.includes("BrandStill"), "first book has no decorative still");

const marketing = readFileSync(
  join(process.cwd(), "src/components/home/marketing-home.tsx"),
  "utf8",
);
assert(!marketing.includes("BrandStill"), "marketing has no hero still");
assert(!marketing.includes("Learn"), "marketing does not revive Learn");
assert(
  marketing.includes("See when you can stop working, with every assumption visible."),
  "marketing Retire card is one sentence",
);
assert(
  marketing.includes("Freedom, Engineered."),
  "marketing hero stays Freedom, Engineered.",
);
assert(
  marketing.includes("Budget") &&
    marketing.includes("Invest") &&
    marketing.includes("Retire"),
  "marketing pillars stay Budget, Invest, Retire",
);

const headerNav = readFileSync(
  join(process.cwd(), "src/components/layout/signed-in-header-nav.tsx"),
  "utf8",
);
assert(
  headerNav.includes("Budget, Invest, Retire"),
  "header nav stays three pillars",
);
assert(!headerNav.includes("Learn"), "header nav has no Learn");
assert(!headerNav.includes("Freedom"), "header nav has no Freedom");

console.log("budget plaid unit tests passed");
