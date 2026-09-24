"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import {
  LOGIN_PATH,
  PRIVACY_PATH,
  SIGNIN_PATH,
  SIGNUP_PATH,
  TERMS_PATH,
} from "@/lib/routes";
import { cn } from "@/lib/utils";

function PublicHeader({ innerClassName }: { innerClassName?: string }) {
  const pathname = usePathname();
  const onSignIn = pathname === LOGIN_PATH || pathname === SIGNIN_PATH;
  const onCreateAccount = pathname === SIGNUP_PATH;

  return (
    <header className="portal-header sticky top-0 z-20">
      <div
        className={cn(
          "mx-auto flex h-14 w-full items-center justify-between gap-2 px-4 sm:h-16 sm:px-6",
          innerClassName,
        )}
      >
        <BrandLogo variant="lockup" asLink priority />
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-label="Account">
          {onSignIn ? null : (
            <Button
              variant="outline"
              className="h-10 border border-border bg-muted px-3 sm:px-4"
              render={<Link href={LOGIN_PATH} />}
            >
              Sign in
            </Button>
          )}
          {onCreateAccount ? null : (
            <Button
              className="h-10 bg-primary px-3 text-primary-foreground hover:bg-[var(--brand-green-deep)] sm:px-4"
              render={<Link href={SIGNUP_PATH} />}
            >
              Create account
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

function PublicFooter({ innerClassName }: { innerClassName?: string }) {
  return (
    <footer className="border-t border-border py-8">
      <p
        className={cn(
          "type-small mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 text-center text-[var(--fg-footer)] sm:px-6",
          innerClassName,
        )}
      >
        <span>© {new Date().getFullYear()} InvestSalsa</span>
        <span aria-hidden="true">·</span>
        <Link href={TERMS_PATH} className="hover:text-foreground">
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link href={PRIVACY_PATH} className="hover:text-foreground">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <span>Educational, not advice</span>
      </p>
    </footer>
  );
}

export function PublicChrome({
  children,
  contentClassName,
  innerClassName = "max-w-5xl",
}: {
  children: React.ReactNode;
  contentClassName?: string;
  innerClassName?: string;
}) {
  return (
    <div className="marketing-home relative flex min-h-svh flex-col bg-background text-foreground">
      <PublicHeader innerClassName={innerClassName} />
      <main className={cn("flex-1", contentClassName)}>{children}</main>
      <PublicFooter innerClassName={innerClassName} />
    </div>
  );
}

export { PublicFooter, PublicHeader };
