# My Invest Master

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
| `FMP_API_KEY` | Yes (Analysis equities) | [Financial Modeling Prep](https://financialmodelingprep.com/) API key — primary source for company profile, statements, ratios, quotes, and historical prices used by Analysis / InvestSalsa Rating / Early Opp |
| `FMP_API_BASE` | No | Override FMP API base (default `https://financialmodelingprep.com/stable`) |
| `MARKET_DATA_YAHOO_FALLBACK` | No | `0` disables Yahoo secondary fallback. Default: FMP first, Yahoo if FMP fails |
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

CoinGecko remains the crypto price source (no FMP key needed for crypto). Set `FMP_API_KEY` in Vercel project settings for production.

Example `.env.local` fragment:

```bash
FMP_API_KEY=your_fmp_key_here
# MARKET_DATA_YAHOO_FALLBACK=0
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

