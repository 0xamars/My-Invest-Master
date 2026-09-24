"use client";

import Link from "next/link";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Button } from "@/components/ui/button";
import { LOGIN_PATH, SIGNUP_PATH } from "@/lib/routes";

const PILLARS = [
  { title: "Budget", body: "See cash." },
  { title: "Invest", body: "Put it to work." },
  { title: "Retire", body: "Plan when you can retire." },
] as const;

export function MarketingHomePage() {
  return (
    <PublicChrome>
      <section className="mx-auto max-w-5xl px-6 pb-12 pt-20 sm:px-8 sm:pb-16 sm:pt-28">
        <h1 className="type-display max-w-3xl text-balance">Freedom, Engineered.</h1>
        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[var(--fg-muted)]">
          Budget → Invest → Retire
        </p>
        <div className="mt-10 flex flex-wrap gap-2">
          <Button
            size="lg"
            className="premium-cta"
            render={<Link href={SIGNUP_PATH} />}
          >
            Create account
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border border-border bg-muted"
            render={<Link href={LOGIN_PATH} />}
          >
            Sign in
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-3">
          {PILLARS.map((item) => (
            <div key={item.title}>
              <h2 className="text-sm font-semibold tracking-tight">{item.title}</h2>
              <p className="type-small mt-2 leading-relaxed text-[var(--fg-muted)]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </PublicChrome>
  );
}
