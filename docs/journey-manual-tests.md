# Product manual tests

Use a real signed-in account. Do not invent leftover, income, holdings, or a Retire date while testing.

## 1. New user lands on Home

1. Sign in as a user with no budget plan.
2. You land on **Home**, not Budget and not a Money Profile wizard.
3. Home shows labeled empties: “No budget yet”, “No holdings”, “Needs leftover and a book”. No invented leftover, book, or date.
4. Open Budget from Home. Empty Budget offers the first-run kit. Accepting the kit must not invent leftover.
5. Nav is only Budget, Invest, Retire. No Learn/Do. No Freedom label. Home is not a fourth tab.

## 2. Invest stays honest

1. Open Invest with no book. The first-book wizard names the book. No holdings are invented.
2. Search a public ticker. Score is above Past / Now / Future.
3. Missing FMP figures stay Unknown. Future is street estimates, not a house forecast.

## 3. Existing leftover + book: Retire shows a real date

1. Sign in as a user who already has leftover assigned **and** a primary book with at least one visible holding.
2. Open Retire.
3. The date is the leftover + book date (or the honest “no crossing yet” label). It is **not** blank and **not** a guessed year.
4. Existing leftover and the existing book stay visible.

## 4. Budget bank and cards

1. Accounts includes Plaid Connect. Envelopes stay the source of truth.
2. A credit card can be paid from an on-budget account into its payment envelope.

## 5. Settings and sign-out

1. Account menu opens Settings and Sign out.
2. Settings has account, display currency, data, and plan — not Money Profile.
3. Sign out returns to the public marketing page.

## 6. Signed-out public page still works. Chat still gone.

1. Open `/` signed out. Marketing loads. Sign in is the CTA.
2. `/chat` and `/assistant` redirect to Invest. No assistant FAB.
3. `/freedom` redirects to Retire. `/money-profile` redirects to Home. Signed-out `/home` asks for sign-in.

## 7. Typecheck and units

`npx tsc --noEmit` and the journey / invest / ticker / budget / retire unit scripts pass.
