# InvestSalsa

Product direction is in [ROADMAP.md](ROADMAP.md). Read that first and follow its product rules.

A modern, beautiful web app for tracking your investment portfolio and planning your retirement.

Built with Next.js, Supabase, and Tailwind CSS.

---

## ✨ Features

- **Portfolio Management** — Add and track stocks, crypto, and other assets

- **Real-time Prices** — Live market data for stocks and cryptocurrencies

- **Performance Tracking** — Profit/Loss, returns, and portfolio allocation

- **Clean Dashboard** — Beautiful, responsive UI

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)

- Supabase account

### Local Setup

1. Clone the repository:

   ```bash

   git clone [https://github.com/0xamars/My-Invest-Master.git](https://github.com/0xamars/My-Invest-Master.git)

   cd My-Invest-Master



- Install dependencies:
  Bash
  ```
  npm install
  ```
- Create `.env.local` and add credentials (see below).
- Run the development server:

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `FMP_API_KEY` | Yes | [Financial Modeling Prep](https://financialmodelingprep.com/) API key — quotes, batch quotes, history, news, symbol search, crypto prices, and Analysis fundamentals. Results are cached in the Supabase warehouse |
| `FMP_API_BASE` | No | Override FMP API base (default `https://financialmodelingprep.com/stable`) |
| `FMP_DISPLAY_GATE_ENABLED` | No | `1` or `true` limits FMP-backed market data to confirmed emails in `FMP_DISPLAY_ALLOWED_EMAILS`. Unset or `0` leaves every surface unchanged. Turning this on needs a Vercel env change and a redeploy |
| `FMP_DISPLAY_ALLOWED_EMAILS` | No | Comma-separated emails that may see FMP data while the display gate is on. Do not commit a real address. Changing the list needs a Vercel env change and a redeploy |
| `PLAID_CLIENT_ID` | No | Plaid client id. Budget Connect bank stays disabled until set |
| `PLAID_SECRET` | No | Plaid secret. Server-only |
| `PLAID_ENV` | No | `sandbox` (default), `development`, or `production` |
| `PLAID_WEBHOOK_URL` | No | `https://<domain>/api/plaid/webhook` — set in the Plaid dashboard |
| `PLAID_REDIRECT_URI` | No | OAuth redirect for some banks. Usually `https://<domain>/budget` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for bank link | Stores Plaid access tokens. Never expose to the browser |

Apply `supabase/migrations/013_user_plaid_items.sql` before the first bank link.

### Plaid dashboard (Amar)

1. Create a Plaid app. Start in **sandbox**.
2. Enable the **Transactions** product.
3. Copy `client_id` and `sandbox` secret into Vercel / `.env.local`. Do not commit secrets.
4. Set webhook to `https://<production-domain>/api/plaid/webhook`.
5. Add an allowed redirect URI for OAuth banks (`https://<production-domain>/budget`).
6. Apply migration `013_user_plaid_items.sql` on the Supabase project.
7. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set on the server.
8. Sandbox test users: `user_good` / `pass_good` (Plaid sandbox docs).

The app boots without Plaid credentials. Connect bank is visible and disabled until env + service role are set.

Crypto prices, charts, and headlines come from FMP (cached). CoinGecko remains for crypto search and logos, because those responses carry CoinGecko ids the logo route still uses. Set `FMP_API_KEY` in Vercel project settings for production. Apply `supabase/migrations/015_market_cache.sql` so news and symbol search share one warehouse row. That table has row level security and no anon or authenticated policies, so only the server (service role) reads and writes it. If production already ran the older 015 that created a public read policy, run `drop policy if exists "Public read market_cache" on public.market_cache;` in the Supabase SQL editor. Search and news rows older than 7 days are deleted opportunistically on later writes.

When `FMP_DISPLAY_GATE_ENABLED` is `1`, stock pages, portfolio live prices, the heatmap, market news, stock ticker search, and analysis quote and fundamentals are served only to a signed-in, confirmed email listed in `FMP_DISPLAY_ALLOWED_EMAILS`. Everyone else sees “Market data is not available on your account yet”, and those API routes return 403. Crypto ticker search stays on CoinGecko and is not part of this gate. Leave the flag unset until you choose to turn the gate on. Turning the gate on, or changing the allowlist, needs a Vercel environment change and a redeploy before it takes effect.

Example `.env.local` fragment:

```bash
FMP_API_KEY=your_fmp_key_here
# FMP_DISPLAY_GATE_ENABLED=1
# FMP_DISPLAY_ALLOWED_EMAILS=allowed@example.com
```

  Bash
  ```
  npm run dev
  ```
- Open [http://localhost:3000](http://localhost:3000)



## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth + Database)
- **UI**: shadcn/ui

---

## Roadmap

- Basic Portfolio tracking
- Advanced charts and analytics
- Retirement planning module
- Subscription system

