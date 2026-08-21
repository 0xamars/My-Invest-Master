"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Eye, Layers, Lock, PieChart, Target } from "lucide-react";
import { BrandHomeLink } from "@/components/layout/brand-home-link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { BudgetSidebarNav } from "@/components/layout/budget-sidebar-nav";
import { NavCategoryIcon } from "@/components/layout/nav-category-icon";
import {
  INVEST_CHILD_NAV,
  INVEST_OPTIONS_PATH,
  INVEST_PATH,
  INVEST_PORTFOLIO_PATH,
  INVEST_WATCHLIST_PATH,
  SIGNED_IN_PRIMARY_NAV,
  isInvestPath,
  isNavItemActive,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { LOGIN_PATH } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

const investChildIcons = {
  [INVEST_PORTFOLIO_PATH]: PieChart,
  [INVEST_WATCHLIST_PATH]: Eye,
  [INVEST_OPTIONS_PATH]: Layers,
} as const;

const retireSubItems = [
  {
    title: "Plan",
    href: "/freedom/plans",
    icon: Target,
  },
];

function navClass(isActive: boolean) {
  return cn("nav-item", isActive && "nav-item-active");
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const authRequired = isSupabaseConfigured();
  const canAccessProtected = !authRequired || Boolean(user);
  const [investOpen, setInvestOpen] = useState(isInvestPath(pathname));
  const [retireOpen, setRetireOpen] = useState(isRetirePath(pathname));

  useEffect(() => {
    if (isInvestPath(pathname)) {
      setInvestOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (isRetirePath(pathname)) {
      setRetireOpen(true);
    }
  }, [pathname]);

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
                if (item.category === "budget") {
                  return (
                    <BudgetSidebarNav
                      key={item.href}
                      isLoading={isLoading}
                      canAccessProtected={canAccessProtected}
                    />
                  );
                }

                if (item.category === "invest") {
                  const investActive = isInvestPath(pathname);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <div className="flex items-center gap-0.5">
                        <SidebarMenuButton
                          isActive={investActive}
                          tooltip={item.title}
                          className={cn(navClass(investActive), "min-w-0 flex-1")}
                          render={<Link href={INVEST_PATH} />}
                        >
                          <NavCategoryIcon category="invest" />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                        <button
                          type="button"
                          className="nav-invest-toggle group-data-[collapsible=icon]:hidden"
                          onClick={() => setInvestOpen((open) => !open)}
                          aria-expanded={investOpen}
                          aria-label={investOpen ? "Collapse Invest menu" : "Expand Invest menu"}
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform duration-200",
                              investOpen && "rotate-180",
                            )}
                          />
                        </button>
                      </div>

                      {investOpen && (
                        <SidebarMenuSub className="nav-invest-submenu mt-1 border-l border-border/60 px-2.5 py-0.5">
                          {INVEST_CHILD_NAV.map((subItem) => {
                            const Icon = investChildIcons[subItem.href];
                            const isLocked = !isLoading && !canAccessProtected;
                            const href = isLocked ? LOGIN_PATH : subItem.href;
                            const isSubActive = isNavItemActive(pathname, subItem.href);

                            return (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton
                                  isActive={isSubActive}
                                  className={navClass(isSubActive)}
                                  render={<Link href={href} />}
                                >
                                  <Icon className="size-4 opacity-80" />
                                  <span>{subItem.title}</span>
                                  {isLocked && (
                                    <Lock className="ml-auto size-3.5 text-muted-foreground" />
                                  )}
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                if (item.category === "retire") {
                  const retireActive = isRetirePath(pathname);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <div className="flex items-center gap-0.5">
                        <SidebarMenuButton
                          isActive={retireActive}
                          tooltip={item.title}
                          className={cn(navClass(retireActive), "min-w-0 flex-1")}
                          render={<Link href={item.href} />}
                        >
                          <NavCategoryIcon category="retire" />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                        <button
                          type="button"
                          className="nav-invest-toggle group-data-[collapsible=icon]:hidden"
                          onClick={() => setRetireOpen((open) => !open)}
                          aria-expanded={retireOpen}
                          aria-label={
                            retireOpen ? "Collapse Freedom menu" : "Expand Freedom menu"
                          }
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform duration-200",
                              retireOpen && "rotate-180",
                            )}
                          />
                        </button>
                      </div>

                      {retireOpen && (
                        <SidebarMenuSub className="nav-invest-submenu mt-1 border-l border-border/60 px-2.5 py-0.5">
                          {retireSubItems.map((subItem) => {
                            const isLocked = !isLoading && !canAccessProtected;
                            const href = isLocked ? LOGIN_PATH : subItem.href;
                            const isSubActive = isNavItemActive(pathname, subItem.href);

                            return (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton
                                  isActive={isSubActive}
                                  className={navClass(isSubActive)}
                                  render={<Link href={href} />}
                                >
                                  <subItem.icon className="size-4 opacity-80" />
                                  <span>{subItem.title}</span>
                                  {isLocked && (
                                    <Lock className="ml-auto size-3.5 text-muted-foreground" />
                                  )}
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isNavItemActive(pathname, item.href, { exact: true })}
                      tooltip={item.title}
                      className={navClass(isNavItemActive(pathname, item.href))}
                      render={<Link href={item.href} />}
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
