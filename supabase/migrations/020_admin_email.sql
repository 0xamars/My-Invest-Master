-- Allowlist of admin emails. The browser cannot read or write it.
-- admin@investsalsa.com is the dedicated test/admin login, not a personal inbox.
-- If that account already exists and the email is confirmed, link it now.
-- If it does not exist yet, the app inserts app_admins on the first confirmed sign-in.
-- Add another admin only with SQL or the service role. There is no in-app signup for this.

create table if not exists public.app_admin_emails (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint app_admin_emails_email_check check (
    email = lower(btrim(email))
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

alter table public.app_admin_emails enable row level security;

revoke all on table public.app_admin_emails from public, anon, authenticated;
grant all on table public.app_admin_emails to service_role;

comment on table public.app_admin_emails is
  'Emails that may become admins. Insert with the SQL editor or service role only.';

insert into public.app_admin_emails (email)
values ('admin@investsalsa.com')
on conflict (email) do nothing;

insert into public.app_admins (user_id)
select u.id
from auth.users u
where u.email is not null
  and lower(btrim(u.email)) = 'admin@investsalsa.com'
  and u.email_confirmed_at is not null
on conflict (user_id) do nothing;
