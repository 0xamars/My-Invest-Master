"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, BarChart3, Landmark, LayoutDashboard, List, Plus } from "lucide-react";
import { useBudgetDialog } from "@/components/budget/budget-dialog-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { cn } from "@/lib/utils";

interface BudgetShellProps {
  planId: string;
  planName: string;
  children: React.ReactNode;
}

export function BudgetShell({ planId, planName, children }: BudgetShellProps) {
  const pathname = usePathname();
  const { openAddTransaction } = useBudgetDialog();
  const { renamePlan } = useBudgetPlans();
  const [name, setName] = useState(planName);
  const basePath = `/budget/plans/${planId}`;

  useEffect(() => {
    setName(planName);
  }, [planName]);

  const navItems = [
    { title: "Overview", href: basePath, icon: LayoutDashboard, exact: true },
    {
      title: "Accounts",
      href: `${basePath}/accounts`,
      icon: Landmark,
      exact: false,
    },
    {
      title: "Transactions",
      href: `${basePath}/transactions`,
      icon: List,
      exact: false,
    },
    {
      title: "Reports",
      href: `${basePath}/reports`,
      icon: BarChart3,
      exact: false,
    },
  ];

  function handleNameBlur() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(planName);
      return;
    }
    if (trimmed !== planName) {
      renamePlan(planId, trimmed);
    }
    setName(trimmed);
  }

  return (
    <>
      <div className="mb-6 space-y-4">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-muted-foreground"
            render={<Link href="/budget" />}
          >
            <ArrowLeft className="size-3.5" />
            All plans
          </Button>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            aria-label="Budget plan name"
            className="h-auto max-w-xl border-none bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-4">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-1.5",
                  isActive && "bg-[var(--brand-green)]/12 text-[var(--brand-green)]",
                )}
                render={<Link href={item.href} />}
              >
                <item.icon className="size-3.5" />
                {item.title}
              </Button>
            );
          })}
        </div>
      </div>

      {children}

      <Button
        type="button"
        size="icon-lg"
        className="fixed bottom-24 right-6 z-40 size-14 rounded-full shadow-xl shadow-black/30"
        onClick={openAddTransaction}
        aria-label="Quick add transaction"
      >
        <Plus className="size-6" />
      </Button>
    </>
  );
}
