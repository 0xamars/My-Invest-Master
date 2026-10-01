# Product manual tests

Use a real signed-in account. Do not invent leftover, income, holdings, or a Retire date while testing.

## 1. New user lands on Home

1. Sign in as a user with no budget plan.
2. You land on **Home**, not Budget and not a Money Profile wizard.
3. Home shows three blocks only: Budget to-assign, Invest top weight, Retire path to target. Empty cards say **Not set up** and a different one-line caption (Budget: create a budget to see money left to assign. Invest: add a holding to see your mix. Retire names the missing step). No invented dollar amount, portfolio weight, or percent.
4. Open Budget from Home. Empty Budget offers the first-run kit. Accepting the kit must not invent leftover.
5. Nav is only Budget, Invest, Retire. No Learn/Do. No Freedom label. Home is not a fourth tab.

## 2. Invest stays honest

1. Open Invest with no book. The first-book wizard names the book. No holdings are invented.
2. Search a public ticker. Rating Engine (section scores + radar + street forecast) is above Score and Past / Now / Future.
3. Missing FMP figures stay Unknown. Future is street estimates, not a house forecast.
4. Open Early Opp from Invest tools or the 16-step card. Search NVDA. All 16 steps render with pass / soft / fail / unknown. Missing FMP figures stay unknown. No leftover bar.

## 3. Existing leftover + book: Retire shows a real date

1. Sign in as a user who already has leftover assigned **and** a primary book with at least one visible holding.
2. Open Retire.
3. The date is the leftover + book date (or the honest “no crossing yet” label). It is **not** blank and **not** a guessed year.
4. Existing leftover and the existing book stay visible.

## 4. Budget bank and cards

With `NEXT_PUBLIC_BANK_CONNECT_ENABLED` unset and no per-user override, Accounts and the register do not show Connect bank. Import a CSV, OFX, or QFX file still works. Envelopes stay the source of truth. A credit card can be paid from an on-budget account into its payment envelope. `BANK_CONNECT_ENABLED=0` keeps Connect bank off for every account.

When the flag is `1`, or an admin sets Bank connection to On for this account, and the encryption key and Plaid sandbox keys are set:

1. Open Accounts. Connect bank is visible. Unassigned money is called Ready to Assign. The screen does not name another budgeting app.
2. Connect bank. In the bank window use username `user_good` and password `pass_good`. Pick a sandbox institution.
3. The next step lists each bank account. Choose an existing budget account, or create a new one, then Save and sync. Transactions show up in the register as normal rows waiting to be assigned.
4. Import an OFX or QFX file of the same activity into that same budget account. Rows that match amount, account, and a close date are not added again.
5. The connection list shows the institution, Sync now, and Disconnect. Sync now pulls newer rows. Disconnect removes the bank link and keeps the transactions already saved. Disconnect still works after the flag is turned off for that account.
6. If the bank sign-in expires, the row asks you to reconnect instead of Sync now. A failed request shows a short sentence, not a stack trace.

Sandbox and production setup are in `docs/plaid.md`.

## 5. Settings and sign-out

1. Account menu opens Settings and Sign out.
2. Settings has account, display currency, data, and plan — not Money Profile.
3. Sign out returns to the public marketing page.

## 6. Signed-out public page still works. Chat still gone.

1. Open `/` signed out. Marketing loads in the first HTML, with no full-page spinner. Hero is **Freedom, Engineered.** The benefit line is leftover cash, what you own, and when you can stop working. The hero and the bottom CTA are Create account. Trust is Educational, not advice. Budget, Invest, and Retire are three feature cards. No example dollar numbers, no account-order comparison, no Canada-only claim, and no couples-only pitch.
2. `/chat` and `/assistant` redirect to Invest. No assistant FAB.
3. `/freedom` redirects to Retire. `/money-profile` redirects to Home. Signed-out `/home` asks for sign-in.

## 7. Budget plan switcher and last opened plan

1. With two budget plans, open one. The plan name stays editable. A menu beside it lists both plans, **All plans**, and **New plan**.
2. From Accounts, Transactions, Payee rules, or Reports, switch plans. You land on that same section of the other plan.
3. With only one plan, there is no menu.
4. Open a plan, go Home, and open Budget from the Home card. It opens that plan, not whichever plan was edited most recently, as long as the plan still exists and can be opened.

## 8. Home empty states

1. With no budget, no holdings, and no Retire plan, each Home card metric is **Not set up** and the caption is a different sentence.
2. Assign every dollar in a budget that also has a holding. The Retire card does not say the setup is missing just because Ready to Assign is zero.
3. With a saved Retire plan that has a real path, the Retire card uses that plan.

## 9. Typecheck and units

`npx tsc --noEmit` and the journey / invest / ticker / budget / retire / early-opp / admin unit scripts pass. Admin units: `npm run test:admin`.

## 10. Admin and a test account

Sign in as `admin@investsalsa.com` after that email is confirmed. That is the dedicated admin login, not a personal account. Sample data is added to that signed-in login. A looked-up account has no sample-data controls. See `docs/admin.md`.

1. Signed out, open `/admin`. The response is a 404. A normal signed-in account that is not an admin also gets a 404.
2. Sign in as an admin and open `/admin`. Look up another account by email. The page shows created date, Free or Premium, and counts. It does not show transaction text, balances, holdings, or bank links. Recent errors says the app does not store error reports. The looked-up account has no **Add sample data** or **Reset this account** control.
3. Set Bank connection to **On for this person** on a looked-up account. Sign in as that account, open Budget, and confirm bank linking is visible while it stays hidden for an account with no override. Set it back to **Use server setting** and confirm bank linking is hidden again when the environment flag is off. With `BANK_CONNECT_ENABLED=0`, bank linking stays hidden even for an account set to On. Disconnect an existing bank still works while the flag is off.
4. On the signed-in admin login, choose **Add sample data**. Budget shows Sample budget with Sample chequing and Sample savings. Invest shows Sample portfolio. Retire shows Sample Retire plan with no invented age or retire date. Names say Sample. Amounts are placeholders.
5. Choose **Reset this account**, then confirm. The sample plans are gone. The sign-in still works. A signed-in admin whose email is not a plus-address test login and is not `admin@investsalsa.com` has no sample-data controls.
6. In the Supabase SQL editor, `select action, target_user_id, created_at from admin_audit_log order by created_at desc limit 20` shows the lookup. It does not show balances or transaction text.
