"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Lock, Wallet } from "lucide-react";
import { NavCategoryIcon } from "@/components/layout/nav-category-icon";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { cn } from "@/lib/utils";

function navClass(isActive: boolean) {
  return cn("nav-item", isActive && "nav-item-active");
}

function isBudgetPath(pathname: string) {
  return pathname === "/budget" || pathname.startsWith("/budget/");
}

function isPlanPath(pathname: string, planId: string) {
  return (
    pathname === `/budget/plans/${planId}` ||
    pathname.startsWith(`/budget/plans/${planId}/`)
  );
}

interface BudgetSidebarNavProps {
  isLoading: boolean;
  canAccessProtected: boolean;
}

export function BudgetSidebarNav({
  isLoading,
  canAccessProtected,
}: BudgetSidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { plans, isLoaded } = useBudgetPlans();
  const hasPlans = isLoaded && plans.length > 0;
  const [budgetOpen, setBudgetOpen] = useState(isBudgetPath(pathname) && hasPlans);

  useEffect(() => {
    if (isBudgetPath(pathname) && hasPlans) {
      setBudgetOpen(true);
    }
  }, [pathname, hasPlans]);

  const budgetActive = isBudgetPath(pathname);
  const href = !isLoading && !canAccessProtected ? "/login" : "/budget";

  function openPlan(planId: string) {
    if (!isLoading && !canAccessProtected) {
      router.push("/login");
      return;
    }
    router.push(`/budget/plans/${planId}`);
  }

  if (!hasPlans) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={budgetActive}
          tooltip="Budget"
          className={navClass(budgetActive)}
          render={<Link href={href} />}
        >
          <NavCategoryIcon category="budget" />
          <span>Budget</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <>
      <SidebarMenuItem>
        <div className="flex items-center gap-0.5">
          <SidebarMenuButton
            isActive={budgetActive}
            tooltip="Budget"
            className={cn(navClass(budgetActive), "min-w-0 flex-1")}
            render={<Link href={href} />}
          >
            <NavCategoryIcon category="budget" />
            <span>Budget</span>
          </SidebarMenuButton>
          <button
            type="button"
            className="nav-invest-toggle group-data-[collapsible=icon]:hidden"
            onClick={() => setBudgetOpen((open) => !open)}
            aria-expanded={budgetOpen}
            aria-label={budgetOpen ? "Collapse Budget menu" : "Expand Budget menu"}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                budgetOpen && "rotate-180",
              )}
            />
          </button>
        </div>

        {budgetOpen && (
          <SidebarMenuSub className="nav-invest-submenu mt-1 border-l border-border/60 px-2.5 py-0.5">
            {plans.map((plan) => {
              const isSubActive = isPlanPath(pathname, plan.id);
              const showLock = !canAccessProtected && !isLoading;

              return (
                <SidebarMenuSubItem key={plan.id}>
                  <SidebarMenuSubButton
                    isActive={isSubActive}
                    className={navClass(isSubActive)}
                    render={
                      <button type="button" onClick={() => openPlan(plan.id)} />
                    }
                  >
                    <Wallet className="size-4 shrink-0 opacity-80" />
                    <span className="truncate">{plan.name}</span>
                    {showLock && (
                      <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    </>
  );
}
