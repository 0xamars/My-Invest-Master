"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/layout/account-menu";
import { HeaderAccountBoundary } from "@/components/layout/header-account-boundary";
import { BrandHomeLink } from "@/components/layout/brand-home-link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SignedInHeaderNav } from "@/components/layout/signed-in-header-nav";
import { BudgetPlansProvider } from "@/contexts/budget-plans-context";
import {
  AUTH_RESET_PATH,
  LOGIN_PATH,
  PRIVACY_PATH,
  SIGNIN_PATH,
  SIGNUP_PATH,
  TERMS_PATH,
} from "@/lib/routes";

function AppShellHeader() {
  return (
    <header className="portal-header portal-header--app sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 px-4 sm:px-5 lg:px-7">
      <BrandHomeLink className="flex min-w-0 items-center gap-2.5">
        <BrandLogo variant="sidebar" priority />
        <span className="sr-only">InvestSalsa</span>
      </BrandHomeLink>
      <SignedInHeaderNav />
      <div className="ml-auto">
        <HeaderAccountBoundary>
          <AccountMenu />
        </HeaderAccountBoundary>
      </div>
    </header>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAuthPublic =
    pathname === LOGIN_PATH ||
    pathname === SIGNUP_PATH ||
    pathname === SIGNIN_PATH ||
    pathname === AUTH_RESET_PATH ||
    pathname.startsWith(`${AUTH_RESET_PATH}/`);
  const isMarketingPublic = pathname === "/";
  const isLegalPublic = pathname === PRIVACY_PATH || pathname === TERMS_PATH;
  const isPublicChrome = isAuthPublic || isMarketingPublic || isLegalPublic;

  if (isPublicChrome) {
    return <div className="relative min-h-svh w-full bg-background">{children}</div>;
  }

  return (
    <div className="desk-app relative flex min-h-svh flex-col bg-background">
      <AppShellHeader />
      <main className="relative flex flex-1 flex-col px-4 py-4 pb-24 sm:px-5 lg:px-7 lg:py-5 md:pb-8">
        <div className="page-shell">{children}</div>
      </main>
      <footer className="relative hidden border-t border-border px-6 py-4 text-xs text-muted-foreground md:block lg:px-8">
        <div className="page-shell flex flex-wrap items-center justify-between gap-3">
          <p>Not investment advice.</p>
          <div className="flex gap-4">
            <Link href={TERMS_PATH} className="hover:text-foreground">
              Terms
            </Link>
            <Link href={PRIVACY_PATH} className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
      <MobileTabBar />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <BudgetPlansProvider>
      <AppShellInner>{children}</AppShellInner>
    </BudgetPlansProvider>
  );
}
