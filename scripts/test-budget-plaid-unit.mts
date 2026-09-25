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
import {
  formatPlaidItemSyncLine,
  parsePlaidWebhookBody,
  plaidErrorNeedsReconnect,
  plaidItemNeedsUserReconnect,
  resolvePlaidWebhookItemStatus,
} from "../src/lib/plaid/item-status.ts";
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
assert(ui.includes("Reconnect"), "item errors offer Reconnect");
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
assert(
  formatPlaidItemSyncLine({
    status: "needs_reconnect",
    lastSyncedAt: "2026-09-01T00:00:00.000Z",
  }).includes("reconnect"),
  "expired item copy asks to reconnect",
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
assert(firstBook.includes("Create the book"), "first book keeps the create action");
assert(!firstBook.includes("learnLabel"), "first book has no Open Invest self-link");
assert(!firstBook.includes("BrandStill"), "first book has no decorative still");

const marketing = readFileSync(
  join(process.cwd(), "src/components/home/marketing-home.tsx"),
  "utf8",
);
assert(!marketing.includes("BrandStill"), "marketing has no hero still");
assert(!marketing.includes("Learn"), "marketing does not revive Learn");
assert(
  marketing.includes("Know when you can stop working, and which order to draw from."),
  "marketing Retire pillar is one sentence",
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
