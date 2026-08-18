import type { Metadata } from "next";
import Link from "next/link";
import { TERMS_PATH } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Privacy · InvestSalsa",
  description:
    "How InvestSalsa stores Budget, Invest, and Retire plan data. Not investment advice.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
          Legal
        </p>
        <h1 className="page-title mt-2">Privacy</h1>
        <p className="page-description">
          Last updated August 18, 2026. What we store, and how you can export or delete it.
        </p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          When you create an account we store your email and auth credentials
          with Supabase. Signed-in plan data lives in three JSON documents you
          can already read: budget plans, retirement plans, and portfolio
          plans. The browser talks to Supabase with the anon key and your
          session. Row-level security keeps other users out of your rows.
        </p>
        <p>
          Settings can download those three blobs and delete the plan rows.
          Deleting your account wipes those plans and signs you out. If a
          server-side service role is configured, the auth user is removed
          too.
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
  );
}
