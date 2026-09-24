import type { Metadata } from "next";
import Link from "next/link";
import { PublicChrome } from "@/components/layout/public-chrome";
import { TERMS_PATH } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Privacy · InvestSalsa",
  description:
    "How InvestSalsa stores Budget, Invest, and Retire plan data. Not investment advice.",
};

export default function PrivacyPage() {
  return (
    <PublicChrome contentClassName="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
    <article className="flex flex-col gap-6">
      <div>
        <p className="type-eyebrow text-[var(--brand-green-text)]">Legal</p>
        <h1 className="page-title mt-2">Privacy</h1>
        <p className="page-description">
          Last updated September 24, 2026. What we store, and how you can export or delete it.
        </p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          When you create an account we store your email and auth credentials
          with Supabase. Signed-in data includes budget and Retire plans,
          portfolios, watchlists, options, preferences, your money profile, and
          bank-connection metadata. The browser talks to Supabase with the anon
          key and your session. Row-level security keeps other users out of
          your rows. Bank access tokens stay on the server.
        </p>
        <p>
          Settings can download that data. The download does not include bank
          access tokens. Deleting your account removes your rows and signs you
          out. When the server can, it disconnects linked banks before those
          tokens are deleted, then removes the auth user.
        </p>
        <p>
          We use account email to send password-reset links. We do not sell
          your plan data. Market prices and news are fetched to show quotes —
          those requests are not a dossier on you.
        </p>
        <p className="font-medium text-foreground">
          InvestSalsa is not investment advice. Figures you type (including
          leftover cash applied to the book) stay yours.
        </p>
        <p>
          See{" "}
          <Link href={TERMS_PATH} className="text-foreground underline-offset-4 hover:underline">
            Terms
          </Link>
          . Questions:{" "}
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
    </PublicChrome>
  );
}
