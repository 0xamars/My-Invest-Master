"use client";

import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";

const pageTitles: Record<string, string> = {
  "/": "Home",
  "/portfolio": "Portfolio",
  "/options": "Options",
  "/holdings": "Holdings",
  "/performance": "Performance",
  "/analytics": "Analytics",
  "/markets": "Markets",
  "/settings": "Settings",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Invest Salsa";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
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
        <main className="flex flex-1 flex-col px-6 py-8 lg:px-8 lg:py-10">
          <div className="page-shell">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
