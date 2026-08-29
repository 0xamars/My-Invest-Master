"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandHomeLink } from "@/components/layout/brand-home-link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { NavCategoryIcon } from "@/components/layout/nav-category-icon";
import {
  SIGNED_IN_PRIMARY_NAV,
  isBudgetPath,
  isInvestPath,
  isRetirePath,
} from "@/lib/chrome/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { LOGIN_PATH } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

function isPrimaryActive(pathname: string, category: string): boolean {
  if (category === "budget") return isBudgetPath(pathname);
  if (category === "invest") return isInvestPath(pathname);
  if (category === "retire") return isRetirePath(pathname);
  return false;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const authRequired = isSupabaseConfigured();
  const canAccessProtected = !authRequired || Boolean(user);

  return (
    <Sidebar collapsible="icon" className="portal-sidebar">
      <SidebarHeader className="brand-sidebar-header">
        <BrandHomeLink className="brand-sidebar-mark">
          <BrandLogo variant="sidebar" priority />
        </BrandHomeLink>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {SIGNED_IN_PRIMARY_NAV.map((item) => {
                const active = isPrimaryActive(pathname, item.category);
                const locked = !isLoading && !canAccessProtected;
                const href = locked ? LOGIN_PATH : item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      className={cn("nav-item min-h-11", active && "nav-item-active")}
                      render={<Link href={href} />}
                    >
                      <NavCategoryIcon category={item.category} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
