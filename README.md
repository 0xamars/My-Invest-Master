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
| `NEXT_PUBLIC_BANK_CONNECT_ENABLED` | No | `1` or `true` shows Connect bank. Unset keeps it hidden. Changing it needs a redeploy |
| `BANK_CONNECT_ENABLED` | No | Server switch. `1` or `true` turns the API on. `0` turns it off even if the public flag is on |
| `PLAID_CLIENT_ID` | No | Plaid client id. Server-only |
| `PLAID_SECRET` | No | Plaid secret. Server-only |
| `PLAID_ENV` | No | `sandbox` (default), `development`, or `production` |
| `PLAID_WEBHOOK_URL` | No | `https://<domain>/api/plaid/webhook` — set in the Plaid dashboard |
| `PLAID_REDIRECT_URI` | No | OAuth redirect for some banks. Usually `https://<domain>/budget` |
| `PLAID_TOKEN_ENCRYPTION_KEY` | No | 32-byte key for access tokens at rest. Server-only. `openssl rand -base64 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for bank link | Stores encrypted Plaid access tokens. Never expose to the browser |

Bank connection setup, sandbox credentials, production access, and security notes are in [docs/plaid.md](docs/plaid.md). The flag stays off until those steps are done. Apply `supabase/migrations/013_user_plaid_items.sql` and `supabase/migrations/018_plaid_access_token_encryption.sql` before the first bank link.

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

