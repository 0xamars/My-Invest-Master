"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, BarChart3, Landmark, LayoutDashboard, List, Plus, Undo2 } from "lucide-react";
import { useBudgetDialog } from "@/components/budget/budget-dialog-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBudget } from "@/contexts/budget-context";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { BUDGET_CURRENCIES, type BudgetCurrency } from "@/types/budget";
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
  const {
    budget,
    setPlanCurrency,
    undoLastMutation,
    canUndo,
    lastMutationLabel,
  } = useBudget();
  const [name, setName] = useState(planName);
  const basePath = `/budget/plans/${planId}`;
  const currency = budget.currency === "CAD" ? "CAD" : "USD";

  useEffect(() => {
    setName(planName);
  }, [planName]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (!canUndo) return;
        event.preventDefault();
        undoLastMutation();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUndo, undoLastMutation]);

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
      <div className="mb-5 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 gap-1.5 text-muted-foreground"
          render={<Link href="/budget" />}
        >
          <ArrowLeft className="size-3.5" />
          All plans
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
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
            className="h-auto max-w-xl border-none bg-transparent px-0 text-[1.65rem] font-semibold tracking-tight shadow-none focus-visible:ring-0"
          />
          <Select
            value={currency}
            onValueChange={(value) =>
              setPlanCurrency((value ?? "USD") as BudgetCurrency)
            }
          >
            <SelectTrigger className="h-8 w-[7.5rem] rounded-full text-xs">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <nav className="budget-nav" aria-label="Budget sections">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 rounded-full px-3",
                  isActive &&
                    "bg-card text-foreground shadow-sm ring-1 ring-border/70",
                )}
                render={<Link href={item.href} />}
              >
                <item.icon className="size-3.5" />
                {item.title}
              </Button>
            );
          })}
        </nav>
      </div>

      {canUndo ? (
        <div className="budget-undo-bar mb-4">
          <p className="text-sm">
            {lastMutationLabel ?? "Undo last change"}
            <span className="ml-2 text-xs text-muted-foreground">
              ⌘Z / Ctrl+Z
            </span>
          </p>
          <Button type="button" size="sm" onClick={undoLastMutation}>
            <Undo2 className="size-3.5" />
            Undo
          </Button>
        </div>
      ) : null}

      {children}

      <Button
        type="button"
        size="icon-lg"
        className="fixed right-6 bottom-24 z-40 size-14 rounded-full shadow-xl shadow-[var(--brand-green)]/25"
        onClick={openAddTransaction}
        aria-label="Quick add transaction"
      >
        <Plus className="size-6" />
      </Button>
    </>
  );
}
