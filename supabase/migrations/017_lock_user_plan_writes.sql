-- Users can read user_preferences.plan but cannot insert or update it.
-- Table-level INSERT/UPDATE is revoked first; column grants do not override
-- a remaining table grant. Existing rows are left as they are. New rows
-- still default to 'free' when the column is omitted.
-- service_role is not changed, so a future server writer can set plan.
-- This does not enable plan caps and does not add billing.
--
-- Apply in the Supabase SQL editor only after the app deploy that stops
-- sending plan on preference upserts. The previous deploy still writes plan.
-- Pre-check: select user_id, plan from user_preferences where plan <> 'free';
--
-- supabase-js upsert is INSERT ... ON CONFLICT (user_id) DO UPDATE SET for
-- every column in the payload, including user_id, so UPDATE must include it.
-- RLS with check (auth.uid() = user_id) from 001 still blocks reassignment.

revoke insert, update on table public.user_preferences from public, anon, authenticated;

grant insert (user_id, display_currency, updated_at)
  on table public.user_preferences
  to authenticated;

grant update (user_id, display_currency, updated_at)
  on table public.user_preferences
  to authenticated;

comment on column public.user_preferences.plan is
  'Subscription tier: free | premium. Signed-in users cannot write this column. service_role can.';
