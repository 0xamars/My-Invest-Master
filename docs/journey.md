# Journey

InvestSalsa is one product with three pillars: **Budget**, **Invest**, and **Retire**. Chrome is Budget | Invest | Retire. Home is not a fourth nav item. The user-facing word is **Retire**, never Freedom.

Educational footer, everywhere it is shown:

> Educational. Not financial advice. You can lose money.

This is not advice. The app will not invent leftover, income, holdings, cash, or a Retire date.

## Path

**Sign in → Home → Budget / Invest / Retire.**

1. **Home** (`/home`) — signed-in hub. Honest leftover, book cost, and Retire date from live data. Missing values stay labeled. Not a fourth nav item.
2. **Budget** (`/budget`) — leftover, envelopes, register, Plaid Connect, credit-card payment envelopes. Empty offers the first-run kit.
3. **Invest** (`/invest`) — the public-stock book. Search a name or ticker. Score sits above Past / Now / Future. Empty offers the first-book wizard. An existing book is never hidden or deleted.
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

- Signed-out public marketing (`/`) still works. Legal, login, signup, and `/auth/*` stay public. Marketing shows Sign out if a session is somehow still open.
- Signed-in `/` goes to Home (`/home`).
- Logo click when signed in goes to Home. Logo when signed out goes to `/`.
- Signed-in header is Logo, Budget | Invest | Retire, and an account menu with Settings and Sign out. Home is not a nav pillar.
- Sign out returns to marketing `/`.
- `/chat` and `/assistant` still redirect (chat stays unshipped).
