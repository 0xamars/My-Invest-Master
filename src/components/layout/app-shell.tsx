"use client";

import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { BudgetPlansProvider, useBudgetPlans } from "@/contexts/budget-plans-context";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useAuth } from "@/hooks/use-auth";

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

  const pageTitles: Record<string, string> = {
    "/": "Home",
    "/home": "Home",
    "/invest": "Invest",
    "/options": "Options",
    "/market": "Market",
    "/pricing": "Pricing",
    "/settings": "Settings",
  };

  return pageTitles[pathname] ?? "Invest Salsa";
}

function AppShellHeader() {
  const pathname = usePathname();
  const { getPlan } = useBudgetPlans();
  const { portfolios } = usePortfolioPlans();
  const planMatch = pathname.match(/^\/budget\/plans\/([^/]+)/);
  const portfolioMatch = pathname.match(/^\/portfolio\/([^/]+)/);
  const planName = planMatch ? getPlan(planMatch[1])?.name : null;
  const portfolioName = portfolioMatch
    ? portfolios.find((portfolio) => portfolio.id === portfolioMatch[1])?.name
    : null;
  const title = resolvePageTitle(pathname, planName ?? portfolioName);

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

  // Full-bleed public marketing homepage (logo always lands here)
  const isPublicMarketingHome = pathname === "/";

  if (isPublicMarketingHome) {
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
