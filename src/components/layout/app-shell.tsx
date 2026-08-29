"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AccountMenu } from "@/components/layout/account-menu";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BrandHomeLink } from "@/components/layout/brand-home-link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { BudgetPlansProvider } from "@/contexts/budget-plans-context";
import { useAuth } from "@/hooks/use-auth";
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
    <header className="portal-header sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 px-5 sm:px-6 lg:px-8">
      <BrandHomeLink className="flex min-w-0 items-center gap-2.5 md:hidden">
        <BrandLogo variant="sidebar" priority />
        <span className="sr-only">InvestSalsa</span>
      </BrandHomeLink>
      <div className="ml-auto">
        <AccountMenu />
      </div>
    </header>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading } = useAuth();

  const isPublicChrome =
    pathname === "/" ||
    pathname === LOGIN_PATH ||
    pathname === SIGNUP_PATH ||
    pathname === SIGNIN_PATH ||
    pathname === AUTH_RESET_PATH ||
    pathname.startsWith(`${AUTH_RESET_PATH}/`);

  if (isPublicChrome) {
    return (
      <div className="relative min-h-svh w-full bg-background">
        {isLoading ? (
          <div className="flex min-h-svh items-center justify-center">
            <div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-primary" />
          </div>
        ) : (
          children
        )}
      </div>
    );
  }

  return (
    <SidebarProvider className="relative bg-background">
      <AppSidebar />
      <SidebarInset className="relative bg-background">
        <AppShellHeader />
        <main className="relative flex flex-1 flex-col px-5 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 md:pb-10">
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
      </SidebarInset>
    </SidebarProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <BudgetPlansProvider>
      <AppShellInner>{children}</AppShellInner>
    </BudgetPlansProvider>
  );
}
