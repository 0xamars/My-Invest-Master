-- Shared FMP → Supabase market-data warehouse.
-- Server-managed (service role writes). Clients may read; no client writes.

-- ---------------------------------------------------------------------------
-- 1. market_symbols
-- ---------------------------------------------------------------------------
create table if not exists public.market_symbols (
  symbol text primary key,
  name text,
  asset_type text not null default 'stock',
  exchange text,
  currency text,
  updated_at timestamptz not null default now()
);

create index if not exists market_symbols_asset_type_idx
  on public.market_symbols (asset_type);

-- ---------------------------------------------------------------------------
-- 2. company_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.company_profiles (
  symbol text primary key references public.market_symbols (symbol) on delete cascade,
  sector text,
  industry text,
  country text,
  description text,
  raw_payload jsonb,
  as_of timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists company_profiles_sector_idx
  on public.company_profiles (sector);
create index if not exists company_profiles_industry_idx
  on public.company_profiles (industry);

-- ---------------------------------------------------------------------------
-- 3. financial_statements
-- ---------------------------------------------------------------------------
create table if not exists public.financial_statements (
  id bigint generated always as identity primary key,
  symbol text not null references public.market_symbols (symbol) on delete cascade,
  statement_type text not null check (statement_type in ('income', 'balance', 'cashflow')),
  period_type text not null check (period_type in ('annual', 'quarter', 'ttm')),
  fiscal_date date not null,
  period_label text,
  data jsonb not null default '{}'::jsonb,
  source text not null default 'fmp',
  updated_at timestamptz not null default now(),
  unique (symbol, statement_type, period_type, fiscal_date)
);

create index if not exists financial_statements_symbol_type_idx
  on public.financial_statements (symbol, statement_type, period_type);

-- ---------------------------------------------------------------------------
-- 4. financial_ratios
-- ---------------------------------------------------------------------------
create table if not exists public.financial_ratios (
  id bigint generated always as identity primary key,
  symbol text not null references public.market_symbols (symbol) on delete cascade,
  period_type text not null check (period_type in ('annual', 'quarter', 'ttm')),
  -- TTM / snapshot rows use epoch date so the unique key stays non-null
  fiscal_date date not null default '1970-01-01',
  data jsonb not null default '{}'::jsonb,
  source text not null default 'fmp',
  updated_at timestamptz not null default now(),
  unique (symbol, period_type, fiscal_date)
);

create index if not exists financial_ratios_symbol_period_idx
  on public.financial_ratios (symbol, period_type);

-- ---------------------------------------------------------------------------
-- 5. company_metrics
-- ---------------------------------------------------------------------------
create table if not exists public.company_metrics (
  id bigint generated always as identity primary key,
  symbol text not null references public.market_symbols (symbol) on delete cascade,
  dataset text not null check (
    dataset in (
      'key_metrics',
      'key_metrics_ttm',
      'financial_scores',
      'enterprise_values',
      'owner_earnings',
      'growth',
      'estimates',
      'peers',
      'dcf',
      'ratios_ttm'
    )
  ),
  -- 'na' when dataset is not period-scoped (peers, scores, dcf, …)
  period_type text not null default 'na',
  data jsonb not null default '{}'::jsonb,
  source text not null default 'fmp',
  as_of timestamptz,
  updated_at timestamptz not null default now(),
  unique (symbol, dataset, period_type)
);

create index if not exists company_metrics_symbol_dataset_idx
  on public.company_metrics (symbol, dataset);

-- ---------------------------------------------------------------------------
-- 6. market_quotes
-- ---------------------------------------------------------------------------
create table if not exists public.market_quotes (
  symbol text primary key references public.market_symbols (symbol) on delete cascade,
  price double precision,
  change double precision,
  change_percent double precision,
  market_cap double precision,
  raw_payload jsonb,
  as_of timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. price_history
-- ---------------------------------------------------------------------------
create table if not exists public.price_history (
  symbol text not null references public.market_symbols (symbol) on delete cascade,
  timeframe text not null,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (symbol, timeframe)
);

-- ---------------------------------------------------------------------------
-- 8. data_refresh_state
-- ---------------------------------------------------------------------------
create table if not exists public.data_refresh_state (
  symbol text not null references public.market_symbols (symbol) on delete cascade,
  dataset text not null,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  status text not null default 'ok' check (status in ('ok', 'stale', 'error')),
  error_message text,
  primary key (symbol, dataset)
);

create index if not exists data_refresh_state_status_idx
  on public.data_refresh_state (status);

-- ---------------------------------------------------------------------------
-- RLS: shared read for anon/authenticated; writes via service role only
-- ---------------------------------------------------------------------------
alter table public.market_symbols enable row level security;
alter table public.company_profiles enable row level security;
alter table public.financial_statements enable row level security;
alter table public.financial_ratios enable row level security;
alter table public.company_metrics enable row level security;
alter table public.market_quotes enable row level security;
alter table public.price_history enable row level security;
alter table public.data_refresh_state enable row level security;

-- Drop policies if re-running
drop policy if exists "Public read market_symbols" on public.market_symbols;
drop policy if exists "Public read company_profiles" on public.company_profiles;
drop policy if exists "Public read financial_statements" on public.financial_statements;
drop policy if exists "Public read financial_ratios" on public.financial_ratios;
drop policy if exists "Public read company_metrics" on public.company_metrics;
drop policy if exists "Public read market_quotes" on public.market_quotes;
drop policy if exists "Public read price_history" on public.price_history;
drop policy if exists "Public read data_refresh_state" on public.data_refresh_state;

create policy "Public read market_symbols"
  on public.market_symbols for select using (true);
create policy "Public read company_profiles"
  on public.company_profiles for select using (true);
create policy "Public read financial_statements"
  on public.financial_statements for select using (true);
create policy "Public read financial_ratios"
  on public.financial_ratios for select using (true);
create policy "Public read company_metrics"
  on public.company_metrics for select using (true);
create policy "Public read market_quotes"
  on public.market_quotes for select using (true);
create policy "Public read price_history"
  on public.price_history for select using (true);
create policy "Public read data_refresh_state"
  on public.data_refresh_state for select using (true);

-- No insert/update/delete policies for anon/authenticated → clients cannot write.
-- Service role bypasses RLS for warehouse upserts.
