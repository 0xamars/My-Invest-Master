"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Layers,
  LineChart,
  Lock,
  PieChart,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

const publicNavItems = [
  { title: "Home", href: "/", icon: Home },
  { title: "Performance", href: "/performance", icon: TrendingUp },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Markets", href: "/markets", icon: LineChart },
];

const protectedNavItems = [
  { title: "Portfolio", href: "/portfolio", icon: PieChart },
  { title: "Options", href: "/options", icon: Layers },
  { title: "Holdings", href: "/holdings", icon: Wallet },
];

function navClass(isActive: boolean) {
  return cn("nav-item", isActive && "nav-item-active");
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const authRequired = isSupabaseConfigured();
  const canAccessProtected = !authRequired || Boolean(user);

  return (
    <Sidebar collapsible="icon" className="portal-sidebar">
      <SidebarHeader className="brand-sidebar-header">
        <Link href="/" className="brand-sidebar-mark">
          <BrandLogo variant="sidebar" priority />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {publicNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    className={navClass(pathname === item.href)}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="size-[1.125rem] opacity-80" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {protectedNavItems.map((item) => {
                const isLocked = !isLoading && !canAccessProtected;
                const href = isLocked ? "/?signin=1" : item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={
                        isLocked ? `${item.title} (sign in required)` : item.title
                      }
                      className={navClass(pathname === item.href)}
                      render={<Link href={href} />}
                    >
                      <item.icon className="size-[1.125rem] opacity-80" />
                      <span>{item.title}</span>
                      {isLocked && (
                        <Lock className="ml-auto size-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 px-2 pb-4">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              isActive={pathname === "/settings"}
              className={navClass(pathname === "/settings")}
              render={<Link href="/settings" />}
            >
              <Settings className="size-[1.125rem] opacity-80" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center justify-between rounded-xl px-2 py-1.5">
              <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                Appearance
              </span>
              <ThemeToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
