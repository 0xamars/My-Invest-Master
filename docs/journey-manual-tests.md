# Journey manual tests

Slice E check. Use a real signed-in account. Apply `supabase/migrations/012_user_money_profiles.sql` first. Do not invent leftover, income, holdings, or a Freedom date while testing.

## 1. New user, all beginner, skip money amounts → wizard → Journey Home → Budget Learn → Do

1. Sign in as a user with **no** Money Profile (or delete the `user_money_profiles` row).
2. You should land on the **3-step wizard**, not Journey Home and not a guessed profile.
3. Leave pay / income / age blank (skip money amounts). Finish as beginner knowledge.
4. You land on **Journey Home** (`/home`). Next should be **Create a budget** (not Continue). Budget metric **No budget yet**. Freedom metric **Needs leftover and a book**. Invest metric **No holdings**.
5. Open Budget **Learn**, then **Do**. Empty Do offers the first-run kit. Accepting the kit must not invent leftover.

## 2. Same user cannot open Invest Do until leftover / month close OR “I budget elsewhere.”

1. Stay beginner. Do not assign leftover, close a month, or add a book.
2. Journey Home Invest station is **Not started**. `/invest?tab=do` shows the skip warning, not an invented book.
3. Confirm **I budget elsewhere** **or** assign leftover / close a month. Invest Do then opens.
4. Soft lock is client-side. Middleware must not 404 or bounce `/invest?tab=do` after they have a book or `budgetElsewhere`.

## 3. Existing user who already has leftover + book: Journey Home shows a real Freedom date

1. Sign in as a user who already has leftover assigned (or present) **and** a primary book with at least one visible holding.
2. Open Journey Home.
3. Freedom date is the leftover + book date (or the honest “no crossing yet” label from that path). It is **not** blank and **not** a guessed year.
4. Existing leftover and the existing book stay visible. Nothing is deleted.

## 4. Tools-only flag: lessons available but not forced

1. In Settings → Money Profile, check **I just want the tools** (`flags.toolsOnly`).
2. Track becomes **Tools**. Pillars default to **Do**. Learn is collapsed to Key ideas.
3. Learn tabs still open. Lessons are not required before Do. All Do unlocked.

## 5. Edit profile in Settings; track updates

1. Open Settings → Money Profile → Edit.
2. Change knowledge / goal / risk / tools-only. Save.
3. The one-line summary and track update. Working flags still come from live leftover / book / saved Freedom plan — not from the wizard.

## 6. Signed-out public page still works. Chat still gone.

1. Sign out. `/` is the public marketing page (Freedom, engineered). Sign in / Start still work.
2. `/chat` and `/assistant` redirect (chat stays unshipped). Do not remount chat.
3. Signed-in logo goes to `/home`. Header is Logo, Budget | Invest | Freedom, and the account menu. Sign out returns to marketing `/`.

## 7. Typecheck passes

From the repo root:

```bash
npx tsc --noEmit
npm run test:journey
```

Both must pass. No secrets in the branch.
