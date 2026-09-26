"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
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
  const { user } = useAuth();
  const onSignIn = pathname === LOGIN_PATH || pathname === SIGNIN_PATH;
  const onCreateAccount = pathname === SIGNUP_PATH;
  const showSignIn = !user && !onSignIn;
  const showCreateAccount = !user && !onCreateAccount;

  return (
    <header className="portal-header sticky top-0 z-20">
      <div
        className={cn(
          "mx-auto flex min-h-14 w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 sm:px-6 md:h-16 md:flex-nowrap md:py-0",
          innerClassName,
        )}
      >
        <BrandLogo variant="lockup" asLink priority />
        {showSignIn || showCreateAccount ? (
          <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-label="Account">
            {showSignIn ? (
              <Button
                variant="outline"
                className="h-10 border border-border bg-muted px-3 sm:px-4"
                render={<Link href={LOGIN_PATH} />}
              >
                Sign in
              </Button>
            ) : null}
            {showCreateAccount ? (
              <Button
                className="h-10 bg-primary px-3 text-primary-foreground hover:bg-[var(--brand-green-deep)] sm:px-4"
                render={<Link href={SIGNUP_PATH} />}
              >
                Create account
              </Button>
            ) : null}
          </nav>
        ) : null}
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
