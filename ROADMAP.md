# InvestSalsa Roadmap

Owner: InvestSalsa CEO agent. Last updated: 24 Sep 2026.
Every cloud agent working in this repo should read this file first.

## Goal
Real strangers paying a monthly price. The 90-day paying-stranger clock starts the day we declare go-to-market ready (see the readiness bar below), not before.

## Who we build for first
Canadian DIY households, especially couples, who manage their own RRSP/TFSA and need to plan how to draw them down in retirement.

Why: Canadians repeatedly ask for a couples retirement calculator, and the Canadian planners they recommend have no budget, while the big US budgeting apps don't handle RRSP/TFSA at all (24 Sep 2026 research). A planner needs no bank data, so it carries no Plaid cost or bank-data security burden and is the fastest thing to make excellent.

## Wedge (decided 24 Sep 2026)
Lead with one sharp job: the couples Retire planner. It compares RRSP, TFSA, and non-registered withdrawal orders year by year with taxes, for one or two people, with every assumption visible. Deterministic first.
Budget and Invest stay in the app. Budget becomes the retention layer later (Retire seeded from real spending); it is not the go-to-market wedge.
Price to test: CA$99/year as the main offer, CA$12/month as the alternative. A planner is used a few times a year, so annual fits the usage.

## Product rules (apply to every change)
- Copy says Retire, not Freedom. "Freedom, Engineered." (homepage headline) is the only allowed use of Freedom.
- Never name competitor products in the product UI or copy.
- Content is educational, not advice. Every Retire screen carries that disclaimer.
- Never invent income, positions, leftover cash, or a retire date. Defaults must be clearly generic.
- Stock and market data come from Financial Modeling Prep (FMP) only, cached.
- Never use the founder's real financial data in fixtures, demos, or screenshots.
- Don't turn on pricing, payments, plan enforcement, or new public pages in production. Build them behind flags that stay off.

## Ranked roadmap

Sizes: S = under a day, M = a few days, L = a week or more (for a cloud agent plus review).

| # | Item | Why a user cares | Size | Status | Issue |
|---|---|---|---|---|---|
| 0a | Bank sync correctness: apply Plaid modified/removed, no pending-to-posted duplicates, cursor only advances after a durable save, verify webhook signatures | Duplicate or lost transactions destroy trust in a budget | M | In progress | [#54](https://github.com/0xamars/My-Invest-Master/issues/54) |
| 0b | Budget save conflicts: no silent overwrite across tabs/devices | Edits vanish without warning today | M-L | In progress | [#55](https://github.com/0xamars/My-Invest-Master/issues/55) |
| 0c | Move portfolio prices, ticker search, heatmap, news off Yahoo to cached FMP | Reliability; FMP-only rule | M | In progress | [#56](https://github.com/0xamars/My-Invest-Master/issues/56) |
| 0d | Account basics: "check your email" after signup, full data delete/export incl. Plaid item removal, users can't self-upgrade plan | New users bounce at confirmation; privacy and security | S-M | In progress | [#57](https://github.com/0xamars/My-Invest-Master/issues/57) |
| 1 | Retire account types: RRSP, TFSA, non-registered (plus RRIF conversion at 71), balances and contributions per person | The basic vocabulary of Canadian retirement | M | Next | [#58](https://github.com/0xamars/My-Invest-Master/issues/58) |
| 2 | Retire couples mode: second person in projections and simulation, two CPP/OAS start ages, pension income splitting, survivor view (spouse fields are collected today but unused) | Most planning households are couples; explicitly requested | M | Next | [#59](https://github.com/0xamars/My-Invest-Master/issues/59) |
| 3 | Withdrawal-order comparison: RRSP-first vs TFSA-last vs blended/RRSP meltdown, year-by-year federal plus provincial tax, OAS clawback, side-by-side result | The core question the product answers | L | Planned | [#60](https://github.com/0xamars/My-Invest-Master/issues/60) |
| 4 | Assumptions panel, educational-not-advice disclaimer on every Retire screen, and reference tests: 3 reference couples checked against an independent calculation | Users must be able to trust and check the numbers | M | Planned | [#61](https://github.com/0xamars/My-Invest-Master/issues/61) |
| 5 | Retire direct target: enter a net-worth target directly, alongside the derived spending/withdrawal-rate target, with progress | Many users plan to a number | S | Planned | [#62](https://github.com/0xamars/My-Invest-Master/issues/62) |
| 6 | Free no-login planner page (single-person, limited) that leads into the full couples planner. Built behind a flag, off in production | Top of funnel and a live demo of the engine | M | Planned | [#63](https://github.com/0xamars/My-Invest-Master/issues/63) |
| 7 | Planner landing page and waitlist behind a flag, off in production | Ready the moment launch is approved | S | Planned | [#64](https://github.com/0xamars/My-Invest-Master/issues/64) |
| 8 | OFX/QFX import with Canadian bank presets and re-import dedupe | Reliable Canadian data path for Budget users | M | In progress | [#65](https://github.com/0xamars/My-Invest-Master/issues/65) |
| 9 | Retire seeded from Budget: trailing 12-month actual spending as the editable retirement spending baseline | Links Budget to Retire; the retention layer | S-M | Planned | [#66](https://github.com/0xamars/My-Invest-Master/issues/66) |
| 10 | Sync health: last-synced time per connection, reauth prompts, one-tap "import a file instead" | Stale data is silent today | S-M | Planned | [#67](https://github.com/0xamars/My-Invest-Master/issues/67) |
| 11 | CAD/USD in Budget: accounts in either currency, daily FX, CAD net worth | Canadians hold USD accounts | M | Planned | [#68](https://github.com/0xamars/My-Invest-Master/issues/68) |
| 12 | Server-rendered homepage, signup, and login (today they show a spinner until JavaScript loads) | Faster first view; search engines see content | S | Planned | [#69](https://github.com/0xamars/My-Invest-Master/issues/69) |
| 13 | CI on GitHub Actions running build and `scripts/test-*.mts` | Stops regressions | S | Planned | [#70](https://github.com/0xamars/My-Invest-Master/issues/70) |
| 14 | Privacy page covers Plaid bank data and AI processing | Trust and accuracy | S | Planned | [#71](https://github.com/0xamars/My-Invest-Master/issues/71) |
| 15 | Automatic sync (scheduled/webhook-driven) instead of manual only | New transactions should just show up | M | Planned | [#72](https://github.com/0xamars/My-Invest-Master/issues/72) |
| 16 | Multi-debt payoff planner (snowball/avalanche) | Common request for people paying down loans | M | Later | [#73](https://github.com/0xamars/My-Invest-Master/issues/73) |
| 17 | Year-over-year and annual budget views | Requested for annual planning | M | Later | [#74](https://github.com/0xamars/My-Invest-Master/issues/74) |
| 18 | Retire market simulation upgrade: historical backtest, assumptions visible (current Monte Carlo uses normal returns with fixed volatility) | Users want to see and trust assumptions | M | Later | [#75](https://github.com/0xamars/My-Invest-Master/issues/75) |
| 19 | Age-based stock-to-cash glide path in Retire | Weak user evidence so far | M | Later | [#76](https://github.com/0xamars/My-Invest-Master/issues/76) |
| 20 | Household sharing plus optional personal sub-budget | Partners are a top loved feature in budgeting apps | L | Later | [#77](https://github.com/0xamars/My-Invest-Master/issues/77) |
| B1 | FMP data display: FMP individual plans reportedly don't permit showing data to other users. Gate FMP-backed pages to the founder unless a display licence is approved | Legal use of data | S (gate) | Blocked on decision | [#78](https://github.com/0xamars/My-Invest-Master/issues/78) |

## Go-to-market readiness bar (all must be true before we declare ready)
1. Planner correctness: 3 reference couples match an independent calculation within a stated tolerance, or differences are explained in the assumptions panel.
2. Disclaimer on every Retire screen; all assumptions visible and editable.
3. Onboarding: 5 unpaid testers each get a couples withdrawal-order result in 10 minutes or less without help.
4. Account basics solid: signup confirmation, export, deletion, no self-upgrade (0d).
5. FMP resolved: display licence approved, or FMP-backed pages gated to the founder.
6. Founder's employer conflict-of-interest check cleared.
7. Payments ready in CAD with sales tax (turning on needs founder approval).
8. Measurement: visit, signup, first plan result, and paid events tracked; a written day-60 "active" definition.
9. Copy check: all public copy passes the product rules.
First checkpoint after launch: 300 waitlist signups and 30 prepaid by day 30, or rethink the wedge.

## Deferred
Stock pages for strangers (until B1 is resolved), Budget as a go-to-market wedge, Monte Carlo upgrades, glide path.
