# Admin

`/admin` is for the founder and anyone else added by hand. Everyone else gets a 404, including a signed-out visitor. There is no button in the app to become an admin.

Admins can turn a feature on for one account and can see counts for support. They cannot see transaction details, balances, holdings, or bank links.

## 1. Apply the migration

In the Supabase SQL editor, run `supabase/migrations/018_admin_and_flags.sql`.

That creates three tables. Row level security is on and there are no policies for the browser roles, so a signed-in user cannot read or write them. The server uses the service role key.

`SUPABASE_SERVICE_ROLE_KEY` must be set on the server. Without it, `/admin` stays a 404 even after you insert a row.

## 2. Add an admin

Find the account, then insert that user id. Replace the email. Do not commit a real address.

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'you@example.com';
```

Check:

```sql
select u.email, a.created_at
from public.app_admins a
join auth.users u on u.id = a.user_id;
```

To remove an admin:

```sql
delete from public.app_admins
where user_id = (select id from auth.users where email = 'you@example.com');
```

Sign in as that account and open `/admin`.

## 3. Add a tester

Use a plus-address so mail still arrives in the real inbox, and the account is obviously a test account:

`name+test1@example.com`

`name+test@example.com` and `name+test2@example.com` also count. `name+testing@example.com` does not. A normal address such as `name@example.com` is not a test account.

Sign up with that address and confirm the email. You do not need to put the test account in `app_admins` unless you want to open `/admin` while signed in as the tester.

## 4. Feature flags

Flags stay off for everyone until the matching environment variable is `1` or `true`, or you set an override for one account.

| Flag | Environment variable | What on means |
| --- | --- | --- |
| Bank connection | `NEXT_PUBLIC_BANK_CONNECT_ENABLED` | Bank linking shows in Budget, and the bank routes accept that account. |
| Market data | `FMP_DISPLAY_GATE_ENABLED` | This variable is a gate. When it is on, market data is limited to confirmed emails in `FMP_DISPLAY_ALLOWED_EMAILS`, plus any confirmed account you set to On. |
| Retire planner without sign-in | `NEXT_PUBLIC_RETIRE_NO_LOGIN_PLANNER_ENABLED` | Reserved for a future public Retire page. That page is not published. Turning the flag on does not add a page. |

On `/admin`, look the account up by email, then choose:

- **Use server setting** — delete the override. The environment variable applies.
- **On for this person** — on for this account only.
- **Off for this person** — off for this account even if the environment variable is on.

Changing `NEXT_PUBLIC_BANK_CONNECT_ENABLED` or the market-data gate in Vercel needs a redeploy. A per-user override does not.

Market data notes:

- Leave `FMP_DISPLAY_GATE_ENABLED` unset and every account can still see market data. Overrides do nothing until the gate is on.
- Turn the gate on to hide market data from everyone except the email list and accounts you set to On.
- The account must have confirmed its email.
- Off denies the account even if the email is on the server list.

Bank connection notes:

- Unset means hidden, including for existing bank routes (except the bank webhook, which can still update a link that already exists).
- Turn the flag back on for that account if you need to disconnect a bank. Reset does not remove bank links.

The public Retire planner is not in the app yet. When it is added, it must call `isFeatureEnabled("retire_no_login_planner", userId)` and stay off in production.

## 5. Sample data

On `/admin`, for a test account, **Add sample data** inserts:

- a budget named Sample budget, with Sample chequing, Sample savings, and two sample transactions
- a portfolio named Sample portfolio, with one custom holding named Sample shares
- a Retire plan named Sample Retire plan, with one sample fund

Names start with Sample. Amounts are placeholders. The Retire plan does not set an age, spending, income, or a retire date. Adding sample data again replaces those three named plans and leaves other plans alone.

**Reset this account** deletes that account's budgets, portfolios, watchlists, options, and Retire plans. It does not delete the sign-in, the plan tier, bank links, feature flags, or the admin row.

The same actions exist as a script. It refuses any email that is not a test account.

```bash
TEST_ACCOUNT_EMAIL=name+test1@example.com npx tsx --tsconfig tsconfig.json scripts/seed-test-account.mts
TEST_ACCOUNT_EMAIL=name+test1@example.com npx tsx --tsconfig tsconfig.json scripts/seed-test-account.mts --reset
```

The script needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment. It does not print plan contents.

## 6. What an admin lookup stores

Every lookup writes one row to `admin_audit_log`: admin id, action, target user id, and time. Flag changes, sample data, and reset write a row too. The log does not store transaction text, balances, holdings, or bank tokens.

If the email does not match an account, the row is still written and the target user is empty.

## 7. What admins cannot see

The health panel shows the email, when the account was created, Free or Premium, and counts of budget plans, accounts, transactions, portfolios, and Retire plans, plus the latest activity time.

It does not show:

- transaction payees, categories, or amounts
- account balances
- holdings, tickers, or quantities
- bank tokens or bank connection details
- a list of recent errors (this app does not store error reports)

Plan tier is read-only here. This page cannot upgrade an account.
