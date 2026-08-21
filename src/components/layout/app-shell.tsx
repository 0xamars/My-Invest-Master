"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AccountMenu } from "@/components/layout/account-menu";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BrandHomeLink } from "@/components/layout/brand-home-link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { InvestToolsNav } from "@/components/layout/invest-tools-nav";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { BudgetPlansProvider, useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useWatchlistPlans } from "@/contexts/watchlist-plans-context";
import { useAuth } from "@/hooks/use-auth";
import { isInvestPath, resolvePageTitle } from "@/lib/chrome/nav";
import {
  AUTH_RESET_PATH,
  LOGIN_PATH,
  PRIVACY_PATH,
  SIGNIN_PATH,
  SIGNUP_PATH,
  TERMS_PATH,
} from "@/lib/routes";

function AppShellHeader() {
  const pathname = usePathname();
  const { getPlan } = useBudgetPlans();
  const { portfolios } = usePortfolioPlans();
  const { lists } = useWatchlistPlans();
  const planMatch = pathname.match(/^\/budget\/plans\/([^/]+)/);
  const portfolioMatch = pathname.match(
    /(?:^\/invest)?\/portfolio\/([^/]+)/,
  );
  const watchlistMatch = pathname.match(
    /(?:^\/invest)?\/watchlist\/([^/]+)/,
  );
  const planName = planMatch ? getPlan(planMatch[1])?.name : null;
  const portfolioName = portfolioMatch
    ? portfolios.find((portfolio) => portfolio.id === portfolioMatch[1])?.name
    : null;
  const watchlistName = watchlistMatch
    ? lists.find((list) => list.id === watchlistMatch[1])?.name
    : null;
  const title = resolvePageTitle(
    pathname,
    planName ?? portfolioName ?? watchlistName,
  );
  const showInvestTools = isInvestPath(pathname);

  return (
    <header className="portal-header sticky top-0 z-20 flex min-h-16 shrink-0 flex-col gap-3 px-5 py-3 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <BrandHomeLink className="flex min-w-0 items-center gap-2.5 md:hidden">
          <BrandLogo variant="sidebar" priority />
          <span className="sr-only">InvestSalsa Home</span>
        </BrandHomeLink>
        <div className="ml-0 flex min-w-0 flex-1 flex-col md:ml-0">
          <span className="hidden text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground md:block">
            InvestSalsa
          </span>
          <span className="truncate text-base font-semibold tracking-tight text-foreground">
            {title}
          </span>
        </div>
        <AccountMenu />
      </div>
      {showInvestTools ? <InvestToolsNav /> : null}
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
      <div className="min-h-svh w-full bg-[#16181D]">
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <AppShellHeader />
        <main className="flex flex-1 flex-col px-5 py-6 pb-24 sm:px-6 lg:px-8 lg:py-10 md:pb-10">
          <div className="page-shell">{children}</div>
        </main>
        <footer className="hidden border-t border-border/60 px-6 py-4 text-xs text-muted-foreground md:block lg:px-8">
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
        <AssistantChat />
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
