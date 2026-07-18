"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/layout/app-sidebar";

const pageTitles: Record<string, string> = {
  "/portfolio": "Portfolio",
  "/holdings": "Holdings",
  "/performance": "Performance",
  "/analytics": "Analytics",
  "/markets": "Markets",
  "/settings": "Settings",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "My Invest Master";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-transparent">
        <header className="portal-header flex h-14 shrink-0 items-center gap-3 px-4">
          <SidebarTrigger className="-ml-1 hover:bg-white/5" />
          <Separator orientation="vertical" className="mr-1 h-4 bg-white/10" />
          <Image
            src="/logo.png"
            alt=""
            width={24}
            height={24}
            aria-hidden
            className="size-6 rounded-md ring-1 ring-white/15 md:hidden"
          />
          <span className="text-sm font-medium tracking-wide text-muted-foreground">
            {title}
          </span>
        </header>
        <main className="flex flex-1 flex-col p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
