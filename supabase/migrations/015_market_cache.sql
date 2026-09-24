-- Shared FMP feed cache (news, symbol search) so a burst of readers
-- reuses one warehouse row instead of calling FMP per request.
-- Quotes stay in market_quotes; price bars stay in price_history.
-- Search queries are cache keys. Nobody but the server needs to read them.

create table if not exists public.market_cache (
  cache_key text not null,
  dataset text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (cache_key, dataset)
);

alter table public.market_cache enable row level security;

drop policy if exists "Public read market_cache" on public.market_cache;

-- No select/insert/update/delete policies for anon or authenticated.
-- Service role bypasses RLS for warehouse reads and writes.
