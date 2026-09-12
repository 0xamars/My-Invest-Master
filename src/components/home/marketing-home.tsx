"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { signOutThenGoHome } from "@/lib/layout/sign-out-home";
import { useGoToMarketingHome } from "@/lib/navigation/marketing-home";
import { APP_HOME_PATH, LOGIN_PATH, PRIVACY_PATH, TERMS_PATH } from "@/lib/routes";

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
  const { user, signOut } = useAuth();
  const goToMarketingHome = useGoToMarketingHome();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutThenGoHome(signOut, goToMarketingHome);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="marketing-home relative min-h-svh overflow-x-hidden bg-background text-foreground">
      <header className="portal-header sticky top-0 z-20">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6 sm:h-16 sm:px-8">
          <BrandLogo variant="lockup" asLink priority />
          <nav className="flex items-center gap-2">
            {user ? (
              <>
                <Button
                  size="lg"
                  className="premium-cta"
                  render={<Link href={APP_HOME_PATH} />}
                >
                  Open Home
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border border-border bg-muted"
                  disabled={signingOut}
                  onClick={() => {
                    void handleSignOut();
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="lg"
                className="border border-border bg-muted"
                render={<Link href={LOGIN_PATH} />}
              >
                Sign in
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
          <h1 className="max-w-xl text-balance text-[2.75rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Retire, engineered.
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-white/60">
            See cash. Put it to work. Know when you are free. Budget, Invest,
            and Retire — one product. Not investment advice.
          </p>
          <div className="mt-10">
            {user ? (
              <Button
                size="lg"
                className="premium-cta"
                render={<Link href={APP_HOME_PATH} />}
              >
                Open Home
              </Button>
            ) : (
              <Button
                size="lg"
                className="premium-cta"
                render={<Link href={LOGIN_PATH} />}
              >
                Sign in
              </Button>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24 sm:px-8">
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
            {user ? (
              <button
                type="button"
                className="hover:text-white/70"
                disabled={signingOut}
                onClick={() => {
                  void handleSignOut();
                }}
              >
                Sign out
              </button>
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
