-- One Money Profile document per signed-in user (Slice A journey rails).
-- JSONB + RLS matches user_retirement_plans / user_budget_plans.

create table if not exists public.user_money_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_money_profiles enable row level security;

drop policy if exists "Users manage own money profile" on public.user_money_profiles;

create policy "Users manage own money profile"
  on public.user_money_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_money_profiles is
  'Per-user Money Profile (country, knowledge, goal, track). One row per auth user.';
