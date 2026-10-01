# Journey

InvestSalsa is one product with three pillars: **Budget**, **Invest**, and **Retire**. Chrome is Budget | Invest | Retire. Home is not a fourth nav item. The user-facing product word is **Retire**, never Freedom. Marketing `/` hero is **Freedom, Engineered.** — brand title only.

## Homepage and marketing copy (owner, 25 Sep 2026)
- Do not pitch the product as Canada-only or couples-only.
- Show no example dollar numbers on the homepage or in marketing copy.
- Nav is Budget, Invest, Retire.
- Copy says Retire, not Freedom. "Freedom, Engineered." as the homepage headline is the only allowed use of Freedom.
- Content is educational, not advice.
- Never name YNAB or Simply Wall St in the product.

Educational footer, everywhere it is shown:

> Educational. Not financial advice. You can lose money.

This is not advice. The app will not invent leftover, income, holdings, cash, or a Retire date.

## Path

**Sign in → Home → Budget / Invest / Retire.**

1. **Home** (`/home`) — signed-in hub. Three blocks only: Budget to-assign, Invest top weight, Retire path to target. One number + one spark each. Empty cards use a short status and a different one-line caption. Ready to Assign of zero is not a missing Retire setup. The Budget card opens the last plan you opened when that plan still exists and can be opened. Not a fourth nav item.
2. **Budget** (`/budget`) — leftover, envelopes, register, credit-card payment envelopes. Bank linking shows when that flag is on for the account. Empty offers the first-run kit.
3. **Invest** (`/invest`) — the public-stock book. Search a name or ticker. Rating Engine (section scores, spider/radar, street forecast) sits above Score and Past / Now / Future. Empty offers the first-book wizard. An existing book is never hidden or deleted. **Early Opp** (`/invest/early-opp`) is the 16-step decision aid under Invest — not a fourth nav pillar.
4. **Retire** (`/retire`) — one date from leftover and the book. Target, on-track, and the lever. A date still needs leftover and the book.

Learn/Do tabs and the Money Profile quiz are unshipped. `/money-profile` redirects to Home. `/freedom` redirects to Retire. `/chat` and `/assistant` redirect to Invest. Chat is unshipped. Do not remount it.

## Honesty

- Never invent leftover, income, holdings, cash, or a Retire date.
- Leftover is one-time cash, not × 12.
- If leftover or the book is missing, Retire prints the gap — not a blank and not a guess.
- Empty Budget / Invest / Retire states stay honest and point at the real next step.
- Existing plans and books are never hidden or deleted.
- Product UI does not name YNAB, Simply Wall St, or Snowflake.

## Middleware and landing

- Signed-out public marketing (`/`) leads with Budget, Invest, and Retire. The only **Freedom** is the hero **Freedom, Engineered.** The benefit line is leftover cash, what you own, and when you can stop working. The hero and the bottom CTA are Create account. Trust is Educational, not advice. Three feature cards are the page focus. No example plan, no example dollar numbers, no Canada-only claim, and no couples-only pitch. After logout, marketing shows Sign in.
- Signed-in `/` goes to Home (`/home`).
- Logo click when signed in goes to Home. Logo when signed out goes to `/`.
- Signed-in header is Logo, Budget | Invest | Retire, and an account menu with Settings and Sign out. Home is not a nav pillar.
- Sign out returns to marketing `/`.
- `/chat` and `/assistant` still redirect (chat stays unshipped).
