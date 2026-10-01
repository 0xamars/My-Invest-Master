-- Admin role, per-user feature flags, and an audit log.
-- Apply in the Supabase SQL editor (or CLI), then apply 020_admin_email.sql.
-- 020 seeds admin@investsalsa.com. There is no in-app way to become an admin.
--
-- app_admins, feature_flag_overrides, and admin_audit_log:
-- row level security is on and there are no policies, so the anon and
-- authenticated API roles cannot read or write. The service role bypasses
-- row level security. Grants for anon and authenticated are revoked as well.
-- The table owner (SQL editor) can still insert into app_admins.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flag_overrides (
  user_id uuid not null references auth.users (id) on delete cascade,
  flag text not null,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, flag),
  constraint feature_flag_overrides_flag_check check (
    flag in (
      'bank_connect',
      'fmp_display',
      'retire_no_login_planner'
    )
  )
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  target_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

alter table public.app_admins enable row level security;
alter table public.feature_flag_overrides enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on table public.app_admins from public, anon, authenticated;
revoke all on table public.feature_flag_overrides from public, anon, authenticated;
revoke all on table public.admin_audit_log from public, anon, authenticated;

grant all on table public.app_admins to service_role;
grant all on table public.feature_flag_overrides to service_role;
grant all on table public.admin_audit_log to service_role;

comment on table public.app_admins is
  'Accounts that may open /admin. Insert rows with the SQL editor or service role only.';
comment on table public.feature_flag_overrides is
  'Per-user on/off for a known flag. No row means the server environment setting.';
comment on table public.admin_audit_log is
  'Admin id, action, target user, and time. No financial contents.';

-- Email lookup for support. Returns id, email, and created time only.
create or replace function public.admin_lookup_user_by_email(target_email text)
returns table (id uuid, email text, created_at timestamptz)
language sql
stable
security definer
set search_path = auth, public, pg_temp
as $$
  select u.id, u.email::text, u.created_at
  from auth.users u
  where target_email is not null
    and u.email is not null
    and lower(u.email) = lower(btrim(target_email))
  limit 1;
$$;

-- Counts and timestamps only. Does not return plan JSON, balances, or tokens.
create or replace function public.admin_user_health(target uuid)
returns table (
  budget_plans integer,
  budget_accounts integer,
  budget_transactions integer,
  portfolios integer,
  retire_plans integer,
  plan text,
  last_activity timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*)::integer from public.user_budget_plans where user_id = target),
    (
      select coalesce(sum(
        case
          when jsonb_typeof(data->'accounts') = 'array'
            then jsonb_array_length(data->'accounts')
          else 0
        end
      ), 0)::integer
      from public.user_budget_plans
      where user_id = target
    ),
    (
      select coalesce(sum(
        case
          when jsonb_typeof(data->'transactions') = 'array'
            then jsonb_array_length(data->'transactions')
          else 0
        end
      ), 0)::integer
      from public.user_budget_plans
      where user_id = target
    ),
    (select count(*)::integer from public.user_portfolio_plans where user_id = target),
    (select count(*)::integer from public.user_retirement_plans where user_id = target),
    (select p.plan from public.user_preferences p where p.user_id = target),
    (
      select max(activity.updated_at)
      from (
        select updated_at from public.user_budget_plans where user_id = target
        union all
        select updated_at from public.user_budgets where user_id = target
        union all
        select updated_at from public.user_retirement_plans where user_id = target
        union all
        select updated_at from public.user_portfolio_plans where user_id = target
        union all
        select updated_at from public.user_portfolios where user_id = target
        union all
        select updated_at from public.user_watchlist_plans where user_id = target
        union all
        select updated_at from public.user_options where user_id = target
        union all
        select updated_at from public.user_preferences where user_id = target
        union all
        select updated_at from public.user_money_profiles where user_id = target
      ) activity
    );
$$;

revoke all on function public.admin_lookup_user_by_email(text) from public, anon, authenticated;
revoke all on function public.admin_user_health(uuid) from public, anon, authenticated;
grant execute on function public.admin_lookup_user_by_email(text) to service_role;
grant execute on function public.admin_user_health(uuid) to service_role;
