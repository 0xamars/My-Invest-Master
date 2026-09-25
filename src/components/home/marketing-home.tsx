import Link from "next/link";
import { ExampleWithdrawalComparison } from "@/components/home/example-withdrawal-comparison";
import { PublicChrome } from "@/components/layout/public-chrome";
import { buttonVariants } from "@/components/ui/button";
import { LOGIN_PATH, SIGNUP_PATH } from "@/lib/routes";

const BENEFIT =
  "See when you can retire, and which accounts to draw from first so you keep more of what you saved.";

const SECONDARY =
  "For one person or a couple. Built around RRSP, RRIF, TFSA and non-registered accounts.";

const TRUST = "Educational, not advice. · Built for Canadians. Amounts in CAD.";

const HERO_ALT =
  "Illustration of a Retire plan showing which accounts to draw from, for one person or a couple.";

const PILLARS = [
  {
    title: "Retire",
    body: "Know when you can stop working, and which order to draw from.",
  },
  {
    title: "Budget",
    body: "See leftover cash after the bills you already have.",
  },
  {
    title: "Invest",
    body: "Follow the holdings you already own.",
  },
] as const;

function HeroVisual() {
  return (
    <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
      {/* next/image rejects SVG sources. The mark is a small original illustration. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing/retire-hero-dark.svg"
        alt={HERO_ALT}
        width={560}
        height={488}
        decoding="async"
        className="hidden w-full dark:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing/retire-hero-light.svg"
        alt={HERO_ALT}
        width={560}
        height={488}
        decoding="async"
        className="block w-full dark:hidden"
      />
    </div>
  );
}

export function MarketingHomePage() {
  return (
    <PublicChrome contentClassName="flex flex-col">
      <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-6 pb-6 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:pb-10 lg:pt-24">
        <div>
          <p className="type-eyebrow text-[var(--fg-eyebrow)]">
            Retire planner for Canadians
          </p>
          <h1 className="type-display mt-3 max-w-xl text-balance">Freedom, Engineered.</h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-foreground sm:text-lg">
            {BENEFIT}
          </p>
          <p className="mt-3 max-w-xl text-pretty text-base leading-relaxed text-[var(--fg-muted)]">
            {SECONDARY}
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={SIGNUP_PATH}
              className={buttonVariants({
                size: "lg",
                className: "premium-cta w-full sm:w-auto",
              })}
            >
              Create your Retire plan
            </Link>
            <Link
              href={LOGIN_PATH}
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "w-full border border-border bg-muted sm:w-auto",
              })}
            >
              Sign in
            </Link>
          </div>
          <p className="type-small mt-4 text-[var(--fg-muted)]">{TRUST}</p>
        </div>
        <HeroVisual />
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        <h2 className="sr-only">Budget, Invest, and Retire</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {PILLARS.map((item) => (
            <li key={item.title} className="surface-card px-5 py-5 sm:px-6 sm:py-6">
              <h3 className="text-sm font-semibold tracking-tight">{item.title}</h3>
              <p className="type-small mt-2 leading-relaxed text-[var(--fg-muted)]">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <ExampleWithdrawalComparison />

      <section className="flex flex-1 flex-col justify-center border-t border-border bg-card">
        <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-8 sm:py-20">
          <h2 className="type-h2 max-w-xl text-balance">Know when you can stop working.</h2>
          <p className="mt-3 max-w-xl text-pretty text-base leading-relaxed text-[var(--fg-muted)]">
            For one person or a couple.
          </p>
          <div className="mt-8">
            <Link
              href={SIGNUP_PATH}
              className={buttonVariants({
                size: "lg",
                className: "premium-cta w-full sm:w-auto",
              })}
            >
              Create your Retire plan
            </Link>
          </div>
          <p className="type-small mt-4 text-[var(--fg-muted)]">Educational, not advice.</p>
        </div>
      </section>
    </PublicChrome>
  );
}
