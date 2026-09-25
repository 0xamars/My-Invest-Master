import Link from "next/link";
import { ExampleWithdrawalComparison } from "@/components/home/example-withdrawal-comparison";
import { PublicChrome } from "@/components/layout/public-chrome";
import { buttonVariants } from "@/components/ui/button";
import { LOGIN_PATH, SIGNUP_PATH } from "@/lib/routes";

const SUBLINE =
  "Plan how the two of you draw down RRSP, RRIF, TFSA, and non-registered accounts. Compare withdrawal orders with federal and Ontario tax and OAS clawback, year by year, with every assumption visible.";

const ALSO = [
  {
    title: "Budget",
    body: "Record the spending you enter.",
  },
  {
    title: "Invest",
    body: "Follow the holdings you already own.",
  },
  {
    title: "Retire",
    body: "Compare how the two of you draw the accounts down.",
  },
] as const;

export function MarketingHomePage() {
  return (
    <PublicChrome contentClassName="flex flex-col">
      <section className="mx-auto w-full max-w-5xl px-6 pb-6 pt-12 sm:px-8 sm:pb-8 sm:pt-16">
        <p className="type-eyebrow text-[var(--fg-eyebrow)]">Couples Retire planner</p>
        <h1 className="type-display mt-3 max-w-3xl text-balance">Freedom, Engineered.</h1>
        <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-foreground sm:text-lg">
          {SUBLINE}
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
        <p className="type-small mt-4 text-[var(--fg-muted)]">Educational, not advice.</p>
        <p className="type-small mt-1 text-[var(--fg-muted)]">
          Built for Canadians. Amounts in CAD.
        </p>
      </section>

      <ExampleWithdrawalComparison />

      <section className="flex-1 border-t border-border bg-card">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-14 sm:grid-cols-3 sm:px-8 sm:py-16">
          {ALSO.map((item) => (
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
