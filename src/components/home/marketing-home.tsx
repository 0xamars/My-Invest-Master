"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { BrandStill } from "@/components/brand/brand-still";
import { Button } from "@/components/ui/button";
import { BRAND, BRAND_SIZE } from "@/lib/brand/assets";
import { LOGIN_PATH, PRIVACY_PATH, TERMS_PATH } from "@/lib/routes";

const PILLARS = [
  {
    title: "Budget",
    body: "See cash first. Ready to Assign, leftover that carries, a register, and bank connect.",
  },
  {
    title: "Invest",
    body: "Put leftover to work. Track the book, mix, and concentration — no broker trading.",
  },
  {
    title: "Retire",
    body: "See when you are free. Target nest egg, on-track verdict, and the lever to pull.",
  },
] as const;

export function MarketingHomePage() {
  return (
    <div className="marketing-home relative min-h-svh overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 field-grain" aria-hidden />

      <header className="portal-header sticky top-0 z-20">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6 sm:h-16 sm:px-8">
          <BrandLogo variant="lockup" asLink priority />
          <nav className="flex items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="border border-border bg-muted"
              render={<Link href={LOGIN_PATH} />}
            >
              Sign in
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div>
            <h1 className="max-w-xl text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Retire, engineered.
            </h1>
            <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-white/60">
              See cash. Put it to work. Know when you are free. Budget, Invest,
              and Retire — one product. Not investment advice.
            </p>
            <div className="mt-10">
              <Button
                size="lg"
                className="premium-cta"
                render={<Link href={LOGIN_PATH} />}
              >
                Sign in
              </Button>
            </div>
          </div>
          <BrandStill
            src={BRAND.heroMark}
            alt=""
            width={BRAND_SIZE.heroMark.width}
            height={BRAND_SIZE.heroMark.height}
            priority
            className="hidden min-h-[16rem] lg:block"
            imageClassName="h-full min-h-[16rem] object-cover object-center"
            sizes="28rem"
          />
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {PILLARS.map((item) => (
              <Link
                key={item.title}
                href={LOGIN_PATH}
                className="surface-card px-6 py-7 transition-colors hover:bg-muted/40"
              >
                <h2 className="text-xl font-semibold tracking-tight text-white">
                  {item.title}
                </h2>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-white/55">
                  {item.body}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-center text-xs text-white/35 sm:flex-row sm:px-8 sm:text-left">
          <p>© {new Date().getFullYear()} InvestSalsa</p>
          <div className="flex flex-wrap justify-center gap-5">
            <Link href={TERMS_PATH} className="hover:text-white/70">
              Terms
            </Link>
            <Link href={PRIVACY_PATH} className="hover:text-white/70">
              Privacy
            </Link>
            <Link href={LOGIN_PATH} className="hover:text-white/70">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
