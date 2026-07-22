-- Portfolio, options, and preferences stored per authenticated user.
-- Run in the Supabase SQL editor or via Supabase CLI.

create table if not exists public.user_portfolios (
  user_id uuid primary key references auth.users (id) on delete cascade,
  holdings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_options (
  user_id uuid primary key references auth.users (id) on delete cascade,
  positions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_currency text not null default 'USD',
  updated_at timestamptz not null default now()
);

alter table public.user_portfolios enable row level security;
alter table public.user_options enable row level security;
alter table public.user_preferences enable row level security;

create policy "Users manage own portfolio"
  on public.user_portfolios
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own options"
  on public.user_options
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own preferences"
  on public.user_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
