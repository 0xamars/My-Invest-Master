import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_PATH } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Terms · InvestSalsa",
  description:
    "InvestSalsa terms of use. Home, Budget, Invest, and Freedom are personal finance tools — not investment advice.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
          Legal
        </p>
        <h1 className="page-title mt-2">Terms of use</h1>
        <p className="page-description">
          Last updated August 18, 2026. Short and real — this is not a prospectus.
        </p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          InvestSalsa is a personal finance product with four live pillars:
          Home, Budget, Invest, and Freedom. You use it to track money you
          already have. We do not execute trades, give personalized
          recommendations, or act as a broker, advisor, or fiduciary.
        </p>
        <p className="font-medium text-foreground">
          Nothing on this site is investment, tax, or legal advice. Past
          figures you type or prices we display are not a recommendation to
          buy or sell anything.
        </p>
        <p>
          You are responsible for the numbers you enter. Plans are stored as
          JSON in your account. InvestSalsa is one product: Home, Budget,
          Invest, and Freedom are included. Create as many budget, portfolio,
          and Freedom plans as you need. Nothing here is a recommendation to
          buy or sell.
        </p>
        <p>
          Accounts use email and password through Supabase Auth. Do not share
          your password. You may export or delete your plan data in Settings.
        </p>
        <p>
          We may change or discontinue features. The product is provided as-is.
          See{" "}
          <Link href={PRIVACY_PATH} className="text-foreground underline-offset-4 hover:underline">
            Privacy
          </Link>{" "}
          for how plan data is stored.
        </p>
        <p>
          Questions:{" "}
          <a
            href="mailto:admin@investsalsa.com"
            className="text-foreground underline-offset-4 hover:underline"
          >
            admin@investsalsa.com
          </a>
          .
        </p>
      </section>
    </article>
  );
}
