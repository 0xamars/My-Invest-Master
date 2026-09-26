import Image from "next/image";
import Link from "next/link";
import { PublicChrome } from "@/components/layout/public-chrome";
import { buttonVariants } from "@/components/ui/button";
import { SIGNUP_PATH } from "@/lib/routes";

const EYEBROW = "Budget · Invest · Retire";

const BENEFIT =
  "See your leftover cash, follow what you own, and know when you can stop working.";

const FEATURES = [
  {
    title: "Budget",
    body: "Leftover cash after the bills you enter.",
  },
  {
    title: "Invest",
    body: "Follow the holdings you already own.",
  },
  {
    title: "Retire",
    body: "See when you can stop working, with every assumption visible.",
  },
] as const;

function HeroArt() {
  return (
    <figure className="mx-auto w-full overflow-hidden rounded-[var(--radius)] lg:mx-0">
      <Image
        src="/brand/marketing/hero-freedom.png"
        alt="Illustration of financial freedom — a clear path toward the horizon"
        width={1280}
        height={720}
        unoptimized
        priority
        sizes="(min-width: 1024px) 34rem, 100vw"
        className="h-auto w-full"
      />
    </figure>
  );
}

export function MarketingHomePage() {
  return (
    <PublicChrome contentClassName="flex flex-col">
      <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-6 pb-6 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:pb-10 lg:pt-24">
        <div>
          <p className="type-eyebrow text-[var(--fg-eyebrow)]">{EYEBROW}</p>
          <h1 className="type-display mt-3 max-w-xl text-balance">Freedom, Engineered.</h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-foreground sm:text-lg">
            {BENEFIT}
          </p>
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={SIGNUP_PATH}
              className={buttonVariants({
                size: "lg",
                className: "premium-cta w-full sm:w-auto",
              })}
            >
              Create account
            </Link>
          </div>
          <p className="type-small mt-4 text-[var(--fg-muted)]">Educational, not advice.</p>
        </div>
        <HeroArt />
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        <h2 className="sr-only">Budget, Invest, and Retire</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((item) => (
            <li key={item.title} className="surface-card px-5 py-5 sm:px-6 sm:py-6">
              <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-[var(--fg-muted)]">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-1 flex-col justify-center border-t border-border bg-card">
        <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-8 sm:py-20">
          <h2 className="type-h2 max-w-xl text-balance">
            Leftover cash, what you own, and when you can stop working.
          </h2>
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
