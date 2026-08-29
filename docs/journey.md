# Journey

InvestSalsa is one product with three pillars: **Budget**, **Invest**, and **Freedom**. Journey Home (`/home`) is the signed-in landing, not a fourth nav item. Chrome stays Budget | Invest | Freedom. The user-facing word is Freedom.

Educational footer, everywhere it is shown:

> Educational. Not financial advice. You can lose money.

This is not advice. The app will not invent leftover, income, holdings, cash, or a Freedom date.

## Path

**Money Profile → Journey Home → Budget Learn/Do → Invest Learn/Do → Freedom Learn/Do.**

1. **Money Profile** (`/money-profile`) — 3-step wizard. Country and currency are required. Pay / income / age can be skipped. Income is never required and never invented. Saving recomputes track.
2. **Journey Home** (`/home`, and signed-in `/`) — command center: one next-step CTA, three stations with leftover / book / Freedom date (or the honest gap). Never invents leftover, book value, or a date.
3. **Budget Learn / Do** — Learn is static lessons. Do is leftover, envelopes, and a real month close. Empty Do offers the first-run kit.
4. **Invest Learn / Do** — Learn is static lessons. Do is the book (quantity, average cost, P/L). Empty Do offers the first-book wizard. An existing book is never hidden or deleted.
5. **Freedom Learn / Do** — Learn is always available. Do can be opened anytime to learn; a date still needs leftover and the book. Saving a plan is encouraged after a book exists.

`/chat` and `/assistant` still redirect to Invest. Chat is unshipped. Do not remount it.

## Tracks

Track is computed from effective knowledge (the more conservative of self-rating and checks) and flags.

| Track | How you get it | Learn | Do |
| --- | --- | --- | --- |
| **Beginner** | Default. Any effective pillar is not confident. | Full lessons. Pillar default is Learn when that pillar's knowledge is beginner. | Invest Do is soft-locked until Budget is working, they confirm they budget elsewhere, or they already have a book. |
| **Fast** | All three effective knowledge levels are confident. | Collapsed to Key ideas. Not forced. | All Do unlocked. Pillar default is Do. |
| **Tools** | `flags.toolsOnly` is true. Wins over Fast. | Lessons are available, collapsed to Key ideas, **not forced**. | All Do unlocked. Pillar default is Do. |

Settings → Money Profile edits the same document. Saving recomputes track.

## Working flags

Derived from live data. Never invented. Recomputed on Journey Home, pillar Learn/Do, and Settings. Persisted only when they change.

| Flag | True when |
| --- | --- |
| `budget.working` | Real leftover is assigned (Ready to Assign present, or leftover already given a job) **or** a month is closed **or** `flags.budgetElsewhere`. |
| `invest.working` | The primary book has ≥1 visible holding **or** (`flags.investNoHoldingsYet` **and** the `invest-the-book` lesson is complete). |
| `freedom.working` | A Freedom plan is saved. |

Station status on Journey Home is **Not started | In progress | Working** (from Locked / Learn / In progress / Working under the hood).

## Soft locks

Soft locks stay **client-side** with skip + warning. Middleware does **not** hard-block Invest Do, even if they already have a book or confirmed they budget elsewhere.

- **Beginner Invest Do** is locked until `budget.working`, **I budget elsewhere** (`flags.budgetElsewhere`), or an existing book (never hide or delete a book).
- Skip warning: leftover and the book will not stay in sync if they skip Budget.
- Fast / Tools: all Do unlocked.
- Freedom Learn is always available. Freedom Do is always available to learn.
- Beginner ticker `/analysis/[symbol]` starts as a plain summary; **Show the details** reveals the cached page. Fast / Tools stay full density. Missing stays Unknown.
- Beginner Options is behind a confirm gate (`flags.optionsConfirmed`). Fast / Tools skip the gate. Options is not deleted.

## First-run kit, first book, ticker, Options

- **Budget first-run kit** — offered only when there is no plan: Housing, Food, Transport, Debt, Fun, Buffer + one Spending account. Leftover and month close stay empty until the user enters them. Existing plans are never wiped.
- **Invest first-book wizard** — offered only when there is no book: name + currency + “this is the book Freedom will use.” No holdings are invented. An existing book is never hidden or deleted. Beginner add-holding explains each field.
- **Beginner ticker** — collapsed until **Show the details**.
- **Options gate** — beginner confirm; Fast / Tools skip.

Freedom has no first-run wizard. Spending-as-assumption copy on Freedom Do stays.

## Honesty

- Never invent leftover, income, holdings, cash, or a Freedom date.
- Leftover is one-time cash, not × 12.
- If leftover or the book is missing, Journey Home prints **Needs leftover and a book** — not a blank and not a guess.
- If a lesson and the tool disagree, the tool wins.
- Empty Budget / Invest / Freedom / Journey Home states stay honest and point at the real next step: Learn, the first-run kit, the first-book wizard, or leftover + the book.
- Existing plans and books are never hidden or deleted.
- Product UI does not name YNAB, Retire, Simply Wall St, Snowflake, Apple, or iOS.

## Middleware and landing

- Signed-out public marketing (`/`) still works. Legal, login, signup, and `/auth/*` stay public.
- Signed-in `/` does not stay on marketing — it goes to Journey Home (or the Money Profile wizard if there is no profile).
- First login / no Money Profile goes to the 3-step wizard (`/money-profile`), then Journey Home.
- Returning user with a profile lands on Journey Home (`/home`).
- Logo click when signed in goes to Journey Home. Logo when signed out goes to `/`.
- Signed-in header is Logo, Budget | Invest | Freedom, and an account menu with Settings and Sign out.
- Journey Home is not a fourth nav pillar.
- `/chat` and `/assistant` still redirect (chat stays unshipped).
- Soft locks stay client-side. Middleware does not hard-block Invest Do.
- Do not invent a profile to pass the gate. A missing table, empty row, or lookup error is **no profile**.

### Migration before first save

Apply `supabase/migrations/012_user_money_profiles.sql` on the project **before** the first Money Profile save.

The loader treats a missing `user_money_profiles` table as **no profile** (Postgres `42P01` or PostgREST `PGRST205`). Middleware uses the same rule. It does not fabricate a draft to let someone through.

## Manual tests

These seven are the Slice E check. Details and expected clicks live in [journey-manual-tests.md](./journey-manual-tests.md).

1. New user, all beginner, skip money amounts → wizard → Journey Home → Budget Learn → Do.
2. Same user cannot open Invest Do until leftover / month close **or** “I budget elsewhere.”
3. Existing user who already has leftover + book: Journey Home shows a real Freedom date, not a blank or a guess.
4. Tools-only flag: lessons available but not forced.
5. Edit profile in Settings; track updates.
6. Signed-out public page still works. Chat still gone.
7. Typecheck passes.
