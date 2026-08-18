"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Crown, LogIn, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import {
  FREE_PLAN_FEATURES,
  PREMIUM_PLAN_FEATURES,
  PRICING_PATH,
} from "@/lib/plans/pricing";
import { LOGIN_PATH, PRIVACY_PATH, SIGNUP_PATH, TERMS_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";

type MarketingHomePageProps = {
  isSignedIn?: boolean;
  dashboardHref?: string;
};

export function MarketingHomePage({
  isSignedIn = false,
  dashboardHref = "/home",
}: MarketingHomePageProps) {
  return (
    <div className="marketing-home dark relative min-h-svh overflow-x-hidden bg-[#050505] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(ellipse_at_top,oklch(0.67_0.19_152/18%),transparent_55%),radial-gradient(ellipse_at_80%_0%,oklch(0.72_0.18_55/12%),transparent_40%)]"
      />

      <header className="relative z-20 border-b border-white/8">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <BrandLogo variant="sidebar" asLink priority className="!gap-2.5" />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="hidden text-white/70 hover:bg-white/8 hover:text-white sm:inline-flex"
              render={<Link href={PRICING_PATH} />}
            >
              Pricing
            </Button>
            {isSignedIn ? (
              <Button
                size="sm"
                className="premium-cta"
                render={<Link href={dashboardHref} />}
              >
                Go to Dashboard
                <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/15 bg-transparent text-white hover:bg-white/8 hover:text-white"
                  render={<Link href={LOGIN_PATH} />}
                >
                  <LogIn className="size-3.5" />
                  Sign in
                </Button>
                <Button
                  size="sm"
                  className="premium-cta hidden sm:inline-flex"
                  render={<Link href={SIGNUP_PATH} />}
                >
                  Start Free
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              Budget · Invest · Retire
            </p>
            <h1 className="max-w-xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
              <span className="brand-text-invest">Freedom,</span>{" "}
              <span className="brand-text-salsa">engineered.</span>
            </h1>
            <p className="max-w-lg text-pretty text-base leading-relaxed text-white/65 sm:text-lg">
              Budget like YNAB, track a real portfolio, and see whether
              retirement is on track — target, gap, and the lever to pull.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              {isSignedIn ? (
                <Button
                  className="premium-cta h-11 px-6"
                  render={<Link href={dashboardHref} />}
                >
                  Go to Dashboard
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  className="premium-cta h-11 px-6"
                  render={<Link href={SIGNUP_PATH} />}
                >
                  Start Free
                  <ArrowRight className="size-4" />
                </Button>
              )}
              <Button
                variant="outline"
                className="h-11 border-white/15 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
                render={<Link href={PRICING_PATH} />}
              >
                <Crown className="size-4 text-[oklch(0.78_0.19_55)]" />
                Explore Premium
              </Button>
            </div>
            <p className="text-xs text-white/45">
              {isSignedIn
                ? "You're signed in — open Home for Budget, Invest, and Retire at a glance."
                : "Free for one budget, one portfolio, and one retirement plan. No credit card — billing is not live yet."}
            </p>
          </div>

          <div className="marketing-visual relative mx-auto w-full max-w-xl lg:max-w-none">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_center,oklch(0.67_0.19_152/28%),transparent_65%)] blur-2xl"
            />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-[0_0_0_1px_oklch(0.67_0.19_152/20%),0_24px_80px_-20px_oklch(0_0_0/80%)]">
              <Image
                src="/marketing/hero-dashboard.png"
                alt="InvestSalsa portfolio overview dashboard preview"
                width={960}
                height={720}
                priority
                className="h-auto w-full object-cover object-center"
              />
            </div>
          </div>
        </section>

        {/* Journey */}
        <section className="border-y border-white/8 bg-white/[0.02] py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
                Your journey
              </p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Budget → Invest → Retire
              </h2>
              <p className="text-pretty text-white/60">
                Three products that are actually live: a working budget, a
                portfolio, and a retirement planner that answers the useful
                questions.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Budget",
                  body: "YNAB-style Ready to Assign, leftover that carries, a register inbox, and CSV import. Manual tracking — bank sync is not live.",
                  accent: "text-primary",
                },
                {
                  step: "02",
                  title: "Invest",
                  body: "Track stocks, crypto, cash, and custom holdings. Check concentration, mix, and allocation drift — then options and watchlists. No broker trading.",
                  accent: "text-[oklch(0.78_0.19_55)]",
                },
                {
                  step: "03",
                  title: "Retire",
                  body: "Know the target nest egg, whether you are on track, and when money runs out. CPP, OAS, savings, and one-click what-ifs.",
                  accent: "text-primary",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
                    {item.step}
                  </p>
                  <h3 className={cn("mt-2 text-lg font-semibold", item.accent)}>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[oklch(0.78_0.19_55)]">
                  Features
                </p>
                <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                  Tools that keep you ahead
                </h2>
                <p className="text-pretty text-white/60">
                  The same three pillars as the product — not a wishlist.
                </p>
              </div>
            </div>

            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "Budget that works like YNAB",
                  body: "Ready to Assign, category available, cover overspend, and a register you can actually use.",
                  accent: "text-primary",
                },
                {
                  title: "Invest without a second app",
                  body: "Holdings, live prices, a risk/allocation checkup, options, and watchlists — plus refresh into Retire.",
                  accent: "text-[oklch(0.78_0.19_55)]",
                },
                {
                  title: "Retire: target and on-track",
                  body: "4% nest-egg target, income vs spend, depletion age, light Monte Carlo, and apply-as-base what-ifs.",
                  accent: "text-primary",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5"
                >
                  <h3 className={cn("text-base font-semibold", item.accent)}>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="marketing-visual overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_24px_70px_-28px_oklch(0.67_0.19_152/40%)]">
              <Image
                src="/marketing/features.png"
                alt="Portfolio tracking, market insights, and retirement planning feature cards"
                width={1600}
                height={700}
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </section>

        {/* Free vs Premium */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[oklch(0.78_0.19_55)]">
                Plans
              </p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Free to start. Premium to scale.
              </h2>
            </div>

            <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="size-4 text-white/50" />
                  <h3 className="text-lg font-semibold">Free</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-white/65">
                  {FREE_PLAN_FEATURES.slice(0, 4).map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-white/40" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-primary/35 bg-primary/10 p-6 shadow-[0_0_40px_-18px_oklch(0.67_0.19_152/50%)]">
                <div className="mb-4 flex items-center gap-2">
                  <Crown className="size-4 text-primary" />
                  <h3 className="text-lg font-semibold">Premium</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-white/75">
                  {PREMIUM_PLAN_FEATURES.slice(0, 5).map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <Button
                className="premium-cta h-11 px-6"
                render={<Link href={PRICING_PATH} />}
              >
                View Pricing
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="pb-20 sm:pb-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/20 via-[#0a0a0a] to-[oklch(0.72_0.18_55/15%)] px-6 py-12 text-center sm:px-10 sm:py-14">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,oklch(0.67_0.19_152/25%),transparent_45%)]"
              />
              <div className="relative space-y-5">
                <div className="mx-auto w-fit">
                  <BrandLogo variant="icon" />
                </div>
                <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                  {isSignedIn ? "Continue in your workspace" : "Start Free today"}
                </h2>
                <p className="mx-auto max-w-md text-pretty text-white/65">
                  {isSignedIn
                    ? "Jump back into Budget, Invest, and Retire from your account dashboard."
                    : "Create an account and start with one budget, one portfolio, and one retirement plan. No credit card — Premium billing is not live yet."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  {isSignedIn ? (
                    <Button
                      className="premium-cta h-11 px-7"
                      render={<Link href={dashboardHref} />}
                    >
                      Go to Dashboard
                      <ArrowRight className="size-4" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="premium-cta h-11 px-7"
                        render={<Link href={SIGNUP_PATH} />}
                      >
                        Start Free
                        <ArrowRight className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 border-white/15 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
                        render={<Link href={LOGIN_PATH} />}
                      >
                        Sign in
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/8 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-center text-xs text-white/40 sm:flex-row sm:px-8 sm:text-left">
          <p>© {new Date().getFullYear()} InvestSalsa</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={PRICING_PATH} className="hover:text-white/70">
              Pricing
            </Link>
            <Link href={TERMS_PATH} className="hover:text-white/70">
              Terms
            </Link>
            <Link href={PRIVACY_PATH} className="hover:text-white/70">
              Privacy
            </Link>
            {isSignedIn ? (
              <Link href={dashboardHref} className="hover:text-white/70">
                Go to Dashboard
              </Link>
            ) : (
              <Link href={LOGIN_PATH} className="hover:text-white/70">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
