"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { BudgetPlansProvider, useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useWatchlistPlans } from "@/contexts/watchlist-plans-context";
import { useAuth } from "@/hooks/use-auth";
import {
  AUTH_RESET_PATH,
  LOGIN_PATH,
  PRIVACY_PATH,
  SIGNIN_PATH,
  SIGNUP_PATH,
  TERMS_PATH,
} from "@/lib/routes";

function resolvePageTitle(pathname: string, planName?: string | null): string {
  if (pathname === "/retire/plans") return "Retirement Planning Models";
  if (pathname.startsWith("/retire/plans/")) return "Retirement Plan";
  if (pathname.startsWith("/retire")) return "Retire";

  if (pathname === "/budget") return "Budget Plans";
  if (pathname.startsWith("/budget/plans/")) {
    if (pathname.endsWith("/transactions")) {
      return planName ? `${planName} · Transactions` : "Transactions";
    }
    if (pathname.endsWith("/reports")) {
      return planName ? `${planName} · Reports` : "Reports";
    }
    if (pathname.endsWith("/accounts")) {
      return planName ? `${planName} · Accounts` : "Accounts";
    }
    return planName ?? "Budget Plan";
  }

  if (pathname === "/portfolio") return "Portfolios";
  if (pathname.startsWith("/portfolio/")) {
    return planName ?? "Portfolio";
  }

  if (pathname === "/watchlist") return "Watchlists";
  if (pathname.startsWith("/watchlist/")) {
    return planName ?? "Watchlist";
  }

  if (pathname === "/analysis") return "Analysis";
  if (pathname.startsWith("/analysis/")) {
    return planName ?? "Analysis";
  }

  const pageTitles: Record<string, string> = {
    "/": "Home",
    "/home": "Home",
    "/invest": "Invest",
    "/options": "Options",
    "/market": "Market",
    "/settings": "Settings",
    "/terms": "Terms",
    "/privacy": "Privacy",
    "/login": "Sign in",
    "/signup": "Create account",
  };

  return pageTitles[pathname] ?? "Invest Salsa";
}

function AppShellHeader() {
  const pathname = usePathname();
  const { getPlan } = useBudgetPlans();
  const { portfolios } = usePortfolioPlans();
  const { lists } = useWatchlistPlans();
  const planMatch = pathname.match(/^\/budget\/plans\/([^/]+)/);
  const portfolioMatch = pathname.match(/^\/portfolio\/([^/]+)/);
  const watchlistMatch = pathname.match(/^\/watchlist\/([^/]+)/);
  const analysisMatch = pathname.match(/^\/analysis\/([^/]+)/);
  const planName = planMatch ? getPlan(planMatch[1])?.name : null;
  const portfolioName = portfolioMatch
    ? portfolios.find((portfolio) => portfolio.id === portfolioMatch[1])?.name
    : null;
  const watchlistName = watchlistMatch
    ? lists.find((list) => list.id === watchlistMatch[1])?.name
    : null;
  const analysisSymbol = analysisMatch
    ? decodeURIComponent(analysisMatch[1]).toUpperCase()
    : null;
  const title = resolvePageTitle(
    pathname,
    planName ?? portfolioName ?? watchlistName ?? analysisSymbol,
  );

  return (
    <header className="portal-header sticky top-0 z-20 flex h-16 shrink-0 items-center px-6 lg:px-8">
      <SidebarTrigger className="-ml-2 size-9 rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
      <div className="ml-4 flex min-w-0 flex-col">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Invest Salsa
        </span>
        <span className="truncate text-base font-semibold tracking-tight text-foreground">
          {title}
        </span>
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
      <div className="min-h-svh w-full bg-[#050505]">
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
        <main className="flex flex-1 flex-col px-6 py-8 lg:px-8 lg:py-10">
          <div className="page-shell">{children}</div>
        </main>
        <footer className="border-t border-border/60 px-6 py-4 text-xs text-muted-foreground lg:px-8">
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
