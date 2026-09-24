-- Users can read user_preferences.plan but cannot insert or update it.
-- Table-level INSERT/UPDATE is revoked first; column grants do not override
-- a remaining table grant. Existing rows are left as they are. New rows
-- still default to 'free' when the column is omitted.
-- service_role is not changed, so a future server writer can set plan.
-- This does not enable plan caps and does not add billing.

revoke insert, update on table public.user_preferences from public, anon, authenticated;

grant insert (user_id, display_currency, updated_at)
  on table public.user_preferences
  to authenticated;

grant update (display_currency, updated_at)
  on table public.user_preferences
  to authenticated;

comment on column public.user_preferences.plan is
  'Subscription tier: free | premium. Signed-in users cannot write this column. service_role can.';
