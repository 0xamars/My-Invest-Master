-- Plaid items and accounts for Budget bank linking.
-- Access tokens stay on the server. RLS is on. Table privileges for
-- anon, authenticated, and public are revoked below, then only the
-- columns the browser reads are granted back. App routes use the
-- service role after auth.getUser().

create table if not exists public.user_plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null,
  item_id text not null,
  access_token text not null,
  institution_id text,
  institution_name text,
  transactions_cursor text,
  status text not null default 'active',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists user_plaid_items_user_plan_idx
  on public.user_plaid_items (user_id, plan_id);

create table if not exists public.user_plaid_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_row_id uuid not null references public.user_plaid_items (id) on delete cascade,
  plaid_account_id text not null,
  budget_account_id text,
  name text,
  official_name text,
  mask text,
  type text,
  subtype text,
  created_at timestamptz not null default now(),
  unique (item_row_id, plaid_account_id)
);

alter table public.user_plaid_items enable row level security;
alter table public.user_plaid_accounts enable row level security;

drop policy if exists "Users read own plaid items" on public.user_plaid_items;
create policy "Users read own plaid items"
  on public.user_plaid_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users delete own plaid items" on public.user_plaid_items;
create policy "Users delete own plaid items"
  on public.user_plaid_items
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users read own plaid accounts" on public.user_plaid_accounts;
create policy "Users read own plaid accounts"
  on public.user_plaid_accounts
  for select
  using (auth.uid() = user_id);

-- Supabase default privileges on schema public grant authenticated ALL on
-- new tables, including TRUNCATE. TRUNCATE ignores row level security, so a
-- logged-in user could wipe every Plaid connection. A column-level REVOKE
-- does not remove a table-level GRANT. Revoke every privilege from anon,
-- authenticated, and public first, then grant only what the browser uses.
-- Service role is not in this list and remains the only writer of tokens.
revoke all on public.user_plaid_items from anon, authenticated, public;
revoke all on public.user_plaid_accounts from anon, authenticated, public;

grant select (
  id, user_id, plan_id, item_id, institution_id, institution_name,
  status, last_synced_at, created_at, updated_at
) on public.user_plaid_items to authenticated;

grant delete on public.user_plaid_items to authenticated;

-- Account export reads these columns. The browser never deletes account
-- rows; the service role does, and deleting an item cascades.
grant select (
  id, user_id, item_row_id, plaid_account_id, budget_account_id,
  name, official_name, mask, type, subtype, created_at
) on public.user_plaid_accounts to authenticated;

comment on table public.user_plaid_items is
  'Plaid Item + access token for a Budget plan. Tokens are server-only.';
comment on column public.user_plaid_items.access_token is
  'Plaid access token. Never expose to the browser.';
