-- Budget data stored per authenticated user (YNAB-style envelope budgeting).

create table if not exists public.user_budgets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_budgets enable row level security;

create policy "Users manage own budget"
  on public.user_budgets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
