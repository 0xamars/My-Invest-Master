import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { LOGIN_PATH, PRIVACY_PATH, SIGNUP_PATH, TERMS_PATH } from "@/lib/routes";

export function AuthPageShell({
  children,
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="marketing-home relative min-h-svh overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 field-grain" aria-hidden />

      <header className="portal-header sticky top-0 z-20">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-6 sm:h-16">
          <BrandLogo variant="lockup" asLink priority />
          <Link
            href={LOGIN_PATH}
            className="inline-flex h-11 items-center rounded-[var(--radius)] border border-border bg-muted px-4 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-col px-6 py-12">
        <div className="surface-card px-6 py-8 sm:px-8">
          {eyebrow ? (
            <p className="mb-3 text-sm text-white/45">{eyebrow}</p>
          ) : null}
          {children}
        </div>
      </main>

      <footer className="relative z-10 py-6">
        <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 px-6 text-xs text-white/35">
          <p>Not investment advice.</p>
          <div className="flex gap-5">
            <Link href={SIGNUP_PATH} className="hover:text-white/70">
              Start
            </Link>
            <Link href={TERMS_PATH} className="hover:text-white/70">
              Terms
            </Link>
            <Link href={PRIVACY_PATH} className="hover:text-white/70">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
