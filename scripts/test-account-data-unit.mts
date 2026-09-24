/**
 * Export and delete cover every user-owned table.
 * Plaid /item/remove runs before tokens are dropped. Plan is not a client write.
 *   npx tsx --tsconfig tsconfig.json scripts/test-account-data-unit.mts
 */
import { readFileSync } from "node:fs";
import {
  planAccountDeletion,
  revokePlaidItemsBeforeDrop,
  userOwnedDeleteOrder,
} from "../src/lib/account/delete-account.ts";
import {
  buildAccountExportPayload,
  containsAccountSecret,
  isAccountExportPayload,
} from "../src/lib/account/export.ts";
import { preferencesCloudWrite } from "../src/lib/account/preferences-write.ts";
import {
  CLIENT_DELETABLE_USER_TABLES,
  PLAID_ITEM_EXPORT_COLUMNS,
  USER_OWNED_TABLES,
} from "../src/lib/account/tables.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

const expectedTables = [
  "user_budget_plans",
  "user_budgets",
  "user_retirement_plans",
  "user_portfolio_plans",
  "user_portfolios",
  "user_watchlist_plans",
  "user_options",
  "user_preferences",
  "user_money_profiles",
  "user_plaid_accounts",
  "user_plaid_items",
];

assert(
  expectedTables.every((table) => (USER_OWNED_TABLES as readonly string[]).includes(table)),
  "owned tables include plans, legacy rows, watchlists, options, preferences, profile, and banks",
);
assert(
  USER_OWNED_TABLES.length === expectedTables.length,
  "owned table list has no extras",
);

for (const table of ["user_plaid_items", "user_plaid_accounts"] as const) {
  assert(
    !(CLIENT_DELETABLE_USER_TABLES as readonly string[]).includes(table),
    `${table} is not deleted from the browser before /item/remove`,
  );
}
assert(
  CLIENT_DELETABLE_USER_TABLES.includes("user_watchlist_plans") &&
    CLIENT_DELETABLE_USER_TABLES.includes("user_options") &&
    CLIENT_DELETABLE_USER_TABLES.includes("user_preferences") &&
    CLIENT_DELETABLE_USER_TABLES.includes("user_money_profiles") &&
    CLIENT_DELETABLE_USER_TABLES.includes("user_budgets") &&
    CLIENT_DELETABLE_USER_TABLES.includes("user_portfolios"),
  "browser delete covers the tables the old wipe skipped",
);

const deleteOrder = userOwnedDeleteOrder();
assert(
  deleteOrder.indexOf("user_plaid_accounts") < deleteOrder.indexOf("user_plaid_items"),
  "plaid accounts are deleted before items",
);
assert(
  deleteOrder.indexOf("user_plaid_items") > deleteOrder.indexOf("user_watchlist_plans"),
  "server delete order includes watchlists before bank rows",
);

assert(
  !PLAID_ITEM_EXPORT_COLUMNS.includes("access_token"),
  "plaid item export columns omit the access token",
);
assert(
  !PLAID_ITEM_EXPORT_COLUMNS.includes("transactions_cursor"),
  "plaid item export columns omit the sync cursor",
);

const emptyRows = Object.fromEntries(
  USER_OWNED_TABLES.map((table) => [table, []]),
) as Record<(typeof USER_OWNED_TABLES)[number], unknown[]>;

const payload = buildAccountExportPayload({
  exportedAt: "2026-09-24T00:00:00.000Z",
  userId: "user-1",
  ...emptyRows,
  user_watchlist_plans: [{ id: "w1", data: { name: "Ideas" } }],
  user_options: [{ positions: [] }],
  user_preferences: [{ display_currency: "USD", plan: "free" }],
  user_money_profiles: [{ data: { primaryGoal: "retire_year" } }],
  user_plaid_items: [
    {
      item_id: "item-1",
      institution_name: "Fixture Bank",
      access_token: "access-sandbox-fixture",
      transactions_cursor: "cursor-secret",
    },
  ],
  user_plaid_accounts: [{ plaid_account_id: "acct-1", name: "Checking" }],
  user_budget_plans: [
    { id: "b1", data: { name: "Budget", access_token: "nested-token" } },
  ],
});

assert(isAccountExportPayload(payload), "full export payload validates");
assert(payload.user_watchlist_plans.length === 1, "export keeps watchlists");
assert(payload.user_options.length === 1, "export keeps options");
assert(payload.user_preferences.length === 1, "export keeps preferences");
assert(payload.user_money_profiles.length === 1, "export keeps the money profile");
assert(payload.user_plaid_accounts.length === 1, "export keeps bank account metadata");
assert(!containsAccountSecret(payload), "export has no access_token key");
assert(
  !JSON.stringify(payload).includes("access-sandbox-fixture"),
  "export drops the plaid access token value",
);
assert(
  !JSON.stringify(payload).includes("nested-token"),
  "export drops a nested access token",
);
const exportedItem = payload.user_plaid_items[0] as { item_id?: string; institution_name?: string };
assert(exportedItem.item_id === "item-1", "export keeps the plaid item id");
assert(exportedItem.institution_name === "Fixture Bank", "export keeps the institution name");

const legacyThreeTables = {
  exportedAt: "2026-09-24T00:00:00.000Z",
  userId: "user-1",
  user_budget_plans: [],
  user_retirement_plans: [],
  user_portfolio_plans: [],
};
assert(
  !isAccountExportPayload(legacyThreeTables),
  "a three-table export is no longer complete",
);

const withToken = {
  ...payload,
  user_plaid_items: [{ item_id: "item-1", access_token: "still-here" }],
};
assert(!isAccountExportPayload(withToken), "a payload that still has an access token is rejected");

const blocked = planAccountDeletion({
  plaidItems: [{ itemId: "item-1", accessToken: "access-sandbox-fixture" }],
  plaidConfigured: false,
});
assert(!blocked.dropRows, "tokens are kept when Plaid is not configured");
assert(blocked.revokeAccessTokens.length === 0, "no revoke list when Plaid is not configured");
assert(blocked.reason === "plaid_not_configured", "block reason names the missing Plaid config");

const ready = planAccountDeletion({
  plaidItems: [
    { itemId: "item-1", accessToken: " access-1 " },
    { itemId: "item-2", accessToken: "access-2" },
  ],
  plaidConfigured: true,
});
assert(ready.dropRows, "rows can drop after a configured revoke");
assert(
  ready.revokeAccessTokens.join(",") === "access-1,access-2",
  "revoke list trims tokens and keeps order",
);

const noBanks = planAccountDeletion({ plaidItems: [], plaidConfigured: false });
assert(noBanks.dropRows, "an account with no banks can be deleted without Plaid");

const calls: string[] = [];
await revokePlaidItemsBeforeDrop({
  accessTokens: ["access-1", "access-2"],
  removeItem: async (token) => {
    calls.push(`remove:${token}`);
  },
  dropRows: async () => {
    calls.push("drop");
  },
});
assert(
  calls.join(">") === "remove:access-1>remove:access-2>drop",
  "each /item/remove finishes before rows are dropped",
);

let dropped = false;
try {
  await revokePlaidItemsBeforeDrop({
    accessTokens: ["access-1"],
    removeItem: async () => {
      throw new Error("plaid down");
    },
    dropRows: async () => {
      dropped = true;
    },
  });
} catch (error) {
  assert(error instanceof Error && error.message === "plaid down", "revoke failure is surfaced");
}
assert(!dropped, "a failed /item/remove does not drop tokens");

const preferenceWrite = preferencesCloudWrite({
  userId: "user-1",
  displayCurrency: "USD",
  updatedAt: "2026-09-24T00:00:00.000Z",
});
assert(!("plan" in preferenceWrite), "preference writes do not include plan");
assert(preferenceWrite.display_currency === "USD", "preference writes still save currency");

const migration = readFileSync(
  "supabase/migrations/015_lock_user_plan_writes.sql",
  "utf8",
);
assert(
  migration.includes(
    "revoke insert, update on table public.user_preferences from public, anon, authenticated",
  ),
  "migration revokes table-level insert and update before column grants",
);
assert(
  migration.includes("grant update (display_currency, updated_at)"),
  "authenticated users can still update currency",
);
assert(
  migration.includes("grant insert (user_id, display_currency, updated_at)"),
  "authenticated users can still insert a preferences row without plan",
);
assert(!/grant\s+(insert|update)\s+\([^)]*\bplan\b/.test(migration), "migration does not grant plan writes");
assert(!migration.toLowerCase().includes("stripe"), "migration does not add payment code");

const caps = readFileSync("src/lib/plans/access.ts", "utf8");
assert(
  caps.includes("export const PLAN_CAPS_ENFORCED = false"),
  "plan caps stay off",
);

const deleteRoute = readFileSync("src/app/api/account/delete/route.ts", "utf8");
assert(deleteRoute.includes("removePlaidItemForDeletion"), "account delete calls Plaid item remove");
assert(
  deleteRoute.includes("revokePlaidItemsBeforeDrop"),
  "account delete revokes before dropping rows",
);
assert(deleteRoute.includes("planAccountDeletion"), "account delete refuses to drop tokens it cannot revoke");

if (failed) {
  console.error(`\n${failed} account-data assertion(s) failed`);
  process.exit(1);
}
console.log("\nall account-data assertions passed");
