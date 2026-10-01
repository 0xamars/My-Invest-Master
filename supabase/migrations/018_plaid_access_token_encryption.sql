-- Access tokens are AES-256-GCM ciphertext written by the server
-- (PLAID_TOKEN_ENCRYPTION_KEY). The browser role cannot read that column.
-- Service role bypasses RLS and is the only writer.

comment on column public.user_plaid_items.access_token is
  'AES-256-GCM ciphertext (v1:iv:tag:data) of the Plaid access token. App key PLAID_TOKEN_ENCRYPTION_KEY. Service role only.';

comment on column public.user_plaid_accounts.budget_account_id is
  'Budget account id this bank account feeds. Transactions live in the budget plan.';

-- Idempotent lock for databases where 013 already ran. Default privileges
-- grant authenticated ALL (including TRUNCATE, which ignores RLS) at
-- CREATE TABLE. A later column-level REVOKE of access_token does nothing
-- while that table-level GRANT remains. Revoke every privilege, then
-- grant only the columns and commands the browser uses. Never grant
-- access_token or transactions_cursor. Service role is not revoked.
revoke all on public.user_plaid_items from anon, authenticated, public;
revoke all on public.user_plaid_accounts from anon, authenticated, public;

grant select (
  id, user_id, plan_id, item_id, institution_id, institution_name,
  status, last_synced_at, created_at, updated_at
) on public.user_plaid_items to authenticated;

grant delete on public.user_plaid_items to authenticated;

grant select (
  id, user_id, item_row_id, plaid_account_id, budget_account_id,
  name, official_name, mask, type, subtype, created_at
) on public.user_plaid_accounts to authenticated;
