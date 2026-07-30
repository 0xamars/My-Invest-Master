-- Budget plans stored per user (one row per plan).

create table if not exists public.user_budget_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists user_budget_plans_user_id_idx
  on public.user_budget_plans (user_id);

alter table public.user_budget_plans enable row level security;

create policy "Users manage own budget plans"
  on public.user_budget_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
