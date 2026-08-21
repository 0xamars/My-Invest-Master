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
    <div className="marketing-home dark relative min-h-svh overflow-x-hidden bg-[#16181D] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,#A3E635_18%,transparent),transparent_55%)]"
      />
      <header className="relative z-20 border-b border-white/8">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-5">
          <BrandLogo variant="sidebar" asLink priority className="!gap-2.5" />
          <Link href={LOGIN_PATH} className="text-sm text-white/60 hover:text-white">
            Sign in
          </Link>
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-col px-5 py-12">
        {eyebrow ? (
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        {children}
      </main>
      <footer className="relative z-10 border-t border-white/8 py-6">
        <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 px-5 text-xs text-white/40">
          <p>Not investment advice.</p>
          <div className="flex gap-4">
            <Link href={LOGIN_PATH} className="hover:text-white/70">
              Sign in
            </Link>
            <Link href={SIGNUP_PATH} className="hover:text-white/70">
              Sign up
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
