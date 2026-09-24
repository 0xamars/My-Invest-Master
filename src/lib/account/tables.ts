/**
 * Rows owned by one auth user. Shared market-data tables are not included.
 * Plaid access tokens are user-owned secrets and are never part of an export.
 */
export const USER_OWNED_TABLES = [
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
] as const;

export type UserOwnedTable = (typeof USER_OWNED_TABLES)[number];

/** Browser session may delete these. Plaid rows are removed only after /item/remove. */
export const CLIENT_DELETABLE_USER_TABLES = [
  "user_budget_plans",
  "user_budgets",
  "user_retirement_plans",
  "user_portfolio_plans",
  "user_portfolios",
  "user_watchlist_plans",
  "user_options",
  "user_preferences",
  "user_money_profiles",
] as const satisfies readonly UserOwnedTable[];

export type ClientDeletableUserTable =
  (typeof CLIENT_DELETABLE_USER_TABLES)[number];

/** Columns the browser role may read. Omits access_token and transactions_cursor. */
export const PLAID_ITEM_EXPORT_COLUMNS =
  "id, user_id, plan_id, item_id, institution_id, institution_name, status, last_synced_at, created_at, updated_at";

export const ACCOUNT_SECRET_KEYS = ["access_token"] as const;

export function tableListOmitsPlaid(
  tables: readonly string[],
): boolean {
  return !tables.includes("user_plaid_items") && !tables.includes("user_plaid_accounts");
}
