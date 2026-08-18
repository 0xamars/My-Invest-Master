"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Eye, Layers, Lock, PieChart, Settings, Target } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { BudgetSidebarNav } from "@/components/layout/budget-sidebar-nav";
import { MarketingHomeLink } from "@/components/layout/marketing-home-link";
import { NavCategoryIcon } from "@/components/layout/nav-category-icon";
import {
  INVEST_CHILD_NAV,
  SIGNED_IN_PRIMARY_NAV,
  isInvestPath,
  isRetirePath,
} from "@/lib/chrome/nav";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { APP_HOME_PATH, LOGIN_PATH, PRIVACY_PATH, TERMS_PATH } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

const investChildIcons = {
  "/portfolio": PieChart,
  "/watchlist": Eye,
  "/options": Layers,
} as const;

const retireSubItems = [
  {
    title: "Plan",
    href: "/retire/plans",
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
        <MarketingHomeLink className="brand-sidebar-mark">
          <BrandLogo variant="sidebar" priority />
        </MarketingHomeLink>
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
                          render={<Link href={item.href} />}
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

                            return (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton
                                  isActive={
                                    pathname === subItem.href ||
                                    pathname.startsWith(`${subItem.href}/`)
                                  }
                                  className={navClass(
                                    pathname === subItem.href ||
                                      pathname.startsWith(`${subItem.href}/`),
                                  )}
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
                            retireOpen ? "Collapse Retire menu" : "Expand Retire menu"
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
                            const isSubActive =
                              pathname === subItem.href ||
                              pathname.startsWith(`${subItem.href}/`);

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
                      isActive={pathname === APP_HOME_PATH}
                      tooltip={item.title}
                      className={navClass(pathname === APP_HOME_PATH)}
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

      <SidebarFooter className="gap-2 px-2 pb-4">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              isActive={pathname === "/settings" || pathname.startsWith("/settings/")}
              className={navClass(
                pathname === "/settings" || pathname.startsWith("/settings/"),
              )}
              render={<Link href="/settings" />}
            >
              <Settings className="size-[1.125rem] opacity-80" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Terms"
              isActive={pathname === TERMS_PATH}
              className={navClass(pathname === TERMS_PATH)}
              render={<Link href={TERMS_PATH} />}
            >
              <span>Terms</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Privacy"
              isActive={pathname === PRIVACY_PATH}
              className={navClass(pathname === PRIVACY_PATH)}
              render={<Link href={PRIVACY_PATH} />}
            >
              <span>Privacy</span>
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
