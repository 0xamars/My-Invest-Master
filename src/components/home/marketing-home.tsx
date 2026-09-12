"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { LOGIN_PATH, PRIVACY_PATH, SIGNUP_PATH, TERMS_PATH } from "@/lib/routes";

const PILLARS = [
  { title: "Budget", body: "See cash." },
  { title: "Invest", body: "Put it to work." },
  { title: "Retire", body: "Know when you are free." },
] as const;

export function MarketingHomePage() {
  return (
    <div className="marketing-home relative min-h-svh overflow-x-hidden bg-background text-foreground">
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
              Login
            </Button>
            <Button
              size="lg"
              className="premium-cta"
              render={<Link href={SIGNUP_PATH} />}
            >
              Sign up
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-12 pt-20 sm:px-8 sm:pb-16 sm:pt-28">
          <h1 className="max-w-3xl text-balance text-[2.5rem] font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Freedom, Engineered.
          </h1>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-white/60">
            Budget → Invest → Retire
          </p>
          <div className="mt-10 flex flex-wrap gap-2">
            <Button
              size="lg"
              className="premium-cta"
              render={<Link href={SIGNUP_PATH} />}
            >
              Sign up
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border border-border bg-muted"
              render={<Link href={LOGIN_PATH} />}
            >
              Login
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20 sm:px-8">
          <div className="grid gap-8 sm:grid-cols-3">
            {PILLARS.map((item) => (
              <div key={item.title}>
                <h2 className="text-sm font-semibold tracking-tight">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
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
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
