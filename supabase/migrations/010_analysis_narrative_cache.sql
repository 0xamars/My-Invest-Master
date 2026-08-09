-- Cached AI narrative bundles for Analysis (server-only writes).
create table if not exists public.analysis_narrative_cache (
  cache_key text primary key,
  symbol text not null,
  model text,
  bundle jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists analysis_narrative_cache_symbol_idx
  on public.analysis_narrative_cache (symbol);

create index if not exists analysis_narrative_cache_expires_idx
  on public.analysis_narrative_cache (expires_at);
