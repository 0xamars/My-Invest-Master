-- Free vs Premium plan on user preferences (Phase 1).
-- Default: free. Premium is set by admin override, testing, or (later) billing.

alter table public.user_preferences
  add column if not exists plan text not null default 'free';

alter table public.user_preferences
  drop constraint if exists user_preferences_plan_check;

alter table public.user_preferences
  add constraint user_preferences_plan_check
  check (plan in ('free', 'premium'));

comment on column public.user_preferences.plan is
  'Subscription tier: free | premium. Admin emails may resolve as premium in app regardless of this value.';
