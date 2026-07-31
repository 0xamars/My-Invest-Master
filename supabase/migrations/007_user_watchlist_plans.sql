-- Watchlists per user (Invest research staging lists).

create table if not exists public.user_watchlist_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists user_watchlist_plans_user_id_idx
  on public.user_watchlist_plans (user_id);

alter table public.user_watchlist_plans enable row level security;

drop policy if exists "Users manage own watchlist plans" on public.user_watchlist_plans;

create policy "Users manage own watchlist plans"
  on public.user_watchlist_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_watchlist_plans is
  'Multi-watchlist records per user for Invest research staging.';
