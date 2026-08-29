"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { BRAND, BRAND_SIZE } from "@/lib/brand/assets";
import { LOGIN_PATH, PRIVACY_PATH, SIGNUP_PATH, TERMS_PATH } from "@/lib/routes";

type MarketingHomePageProps = {
  isSignedIn?: boolean;
  dashboardHref?: string;
};

const PILLARS = [
  {
    title: "Budget",
    body: "See cash first. Ready to Assign, leftover that carries, a register, and CSV import.",
  },
  {
    title: "Invest",
    body: "Put leftover to work. Track the book, mix, and concentration — no broker trading.",
  },
  {
    title: "Freedom",
    body: "See when you are free. Target nest egg, on-track verdict, and the lever to pull.",
  },
] as const;

export function MarketingHomePage({
  isSignedIn = false,
  dashboardHref = "/home",
}: MarketingHomePageProps) {
  return (
    <div className="marketing-home relative min-h-svh overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 field-grain" aria-hidden />

      <header className="portal-header sticky top-0 z-20">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6 sm:h-16 sm:px-8">
          <BrandLogo variant="lockup" asLink priority />
          <nav className="flex items-center gap-2">
            {isSignedIn ? (
              <Button
                size="lg"
                className="premium-cta"
                render={<Link href={dashboardHref} />}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  className="border border-border bg-muted"
                  render={<Link href={LOGIN_PATH} />}
                >
                  Sign in
                </Button>
                <Button
                  size="lg"
                  className="premium-cta hidden sm:inline-flex"
                  render={<Link href={SIGNUP_PATH} />}
                >
                  Start
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
          <div className="flex flex-col items-start">
          <h1 className="max-w-xl text-balance text-[2.75rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Freedom, engineered.
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-white/60">
            See cash. Put it to work. Know when you are free. Budget, Invest,
            and Freedom — one product. Not investment advice.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {isSignedIn ? (
              <Button
                size="lg"
                className="premium-cta"
                render={<Link href={dashboardHref} />}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="premium-cta"
                  render={<Link href={SIGNUP_PATH} />}
                >
                  Start
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border border-border bg-muted"
                  render={<Link href={LOGIN_PATH} />}
                >
                  Sign in
                </Button>
              </>
            )}
          </div>
          </div>
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius)] border border-border bg-card lg:aspect-[16/10]">
            <Image
              src={BRAND.heroMark}
              alt=""
              width={BRAND_SIZE.heroMark.width}
              height={BRAND_SIZE.heroMark.height}
              priority
              sizes="(min-width: 1024px) 22rem, 100vw"
              className="h-full w-full object-cover"
            />
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20 sm:px-8 sm:pb-24">
          <div className="grid gap-4 sm:grid-cols-3">
            {PILLARS.map((item) => (
              <div key={item.title} className="surface-card px-6 py-7">
                <h2 className="text-xl font-semibold tracking-tight text-white">
                  {item.title}
                </h2>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-white/55">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24 sm:px-8">
          <div className="surface-card flex flex-col items-start gap-6 px-6 py-10 sm:px-10">
            <h2 className="text-balance text-3xl font-semibold tracking-tight">
              {isSignedIn ? "Continue" : "Start today"}
            </h2>
            <p className="max-w-md text-pretty leading-relaxed text-white/55">
              {isSignedIn
                ? "Jump back into Budget, Invest, and Freedom."
                : "Create an account. The three products are included."}
            </p>
            {isSignedIn ? (
              <Button
                size="lg"
                className="premium-cta"
                render={<Link href={dashboardHref} />}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="premium-cta"
                render={<Link href={SIGNUP_PATH} />}
              >
                Start
                <ArrowRight className="size-4" />
              </Button>
            )}
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
            {isSignedIn ? (
              <Link href={dashboardHref} className="hover:text-white/70">
                Continue
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
