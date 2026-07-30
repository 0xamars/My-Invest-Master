-- Multiple portfolios per user (Phase 2).
-- Migrates legacy single-row user_portfolios into the new table as Primary.

create table if not exists public.user_portfolio_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists user_portfolio_plans_user_id_idx
  on public.user_portfolio_plans (user_id);

alter table public.user_portfolio_plans enable row level security;

drop policy if exists "Users manage own portfolio plans" on public.user_portfolio_plans;

create policy "Users manage own portfolio plans"
  on public.user_portfolio_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One-time copy: legacy single portfolio → Primary "My Portfolio"
insert into public.user_portfolio_plans (id, user_id, data, updated_at)
select
  migrated.id,
  migrated.user_id,
  jsonb_build_object(
    'id', migrated.id::text,
    'name', 'My Portfolio',
    'isPrimary', true,
    'holdings', coalesce(migrated.holdings, '[]'::jsonb),
    'createdAt', coalesce(migrated.updated_at, now()),
    'updatedAt', coalesce(migrated.updated_at, now())
  ),
  coalesce(migrated.updated_at, now())
from (
  select
    gen_random_uuid() as id,
    legacy.user_id,
    legacy.holdings,
    legacy.updated_at
  from public.user_portfolios legacy
  where not exists (
    select 1
    from public.user_portfolio_plans existing
    where existing.user_id = legacy.user_id
  )
) as migrated;

comment on table public.user_portfolio_plans is
  'Multi-portfolio records per user. Legacy user_portfolios is retained for rollback safety.';
