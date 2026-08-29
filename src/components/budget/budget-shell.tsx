"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  FolderPlus,
  Landmark,
  LayoutDashboard,
  List,
  Plus,
  Undo2,
  Wallet,
} from "lucide-react";
import { CloseMonthDialog } from "@/components/budget/budget-dialogs";
import { BudgetMonthNav } from "@/components/budget/budget-month-nav";
import { useBudgetDialog } from "@/components/budget/budget-dialog-provider";
import { PillarBackLink } from "@/components/layout/pillar-back-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineTitle } from "@/components/ui/inline-title";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBudget } from "@/contexts/budget-context";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import { getCurrentMonthKey } from "@/lib/budget/calculations";
import { isMonthClosed } from "@/lib/budget/closed-months";
import { previewMonthClose } from "@/lib/budget/month-close";
import { cn } from "@/lib/utils";
import {
  BUDGET_CURRENCIES,
  formatMonthLabel,
  shiftMonthKey,
  type BudgetCurrency,
} from "@/types/budget";

interface BudgetMonthContextValue {
  monthKey: string;
  setMonthKey: (monthKey: string) => void;
}

const BudgetMonthContext = createContext<BudgetMonthContextValue | null>(null);

export function useBudgetMonth() {
  const context = useContext(BudgetMonthContext);
  if (!context) {
    throw new Error("useBudgetMonth must be used within BudgetShell");
  }
  return context;
}

function BudgetAddMenu({ iconOnly = false }: { iconOnly?: boolean }) {
  const { openAddTransaction, openAddGroup, openAddEnvelope } = useBudgetDialog();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size={iconOnly ? "icon-lg" : "default"}
            className={iconOnly ? "rounded-full" : undefined}
            aria-label={iconOnly ? "Add" : undefined}
          >
            <Plus className="size-4" />
            {iconOnly ? null : (
              <>
                Add
                <ChevronDown className="size-3.5 opacity-70" />
              </>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={openAddTransaction}>
          <Wallet className="size-4" />
          Transaction
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openAddEnvelope()}>
          <Plus className="size-4" />
          Envelope
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openAddGroup}>
          <FolderPlus className="size-4" />
          Group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface BudgetShellProps {
  planId: string;
  planName: string;
  children: ReactNode;
}

export function BudgetShell({ planId, planName, children }: BudgetShellProps) {
  const pathname = usePathname();
  const { renamePlan } = useBudgetPlans();
  const {
    budget,
    setPlanCurrency,
    undoLastMutation,
    canUndo,
    lastMutationLabel,
    closeMonth,
  } = useBudget();
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey);
  const [closeOpen, setCloseOpen] = useState(false);
  const basePath = `/budget/plans/${planId}`;
  const currency = budget.currency === "CAD" ? "CAD" : "USD";
  const isOverview = pathname === basePath;
  const monthClosed = useMemo(
    () => isMonthClosed(budget, monthKey),
    [budget, monthKey],
  );
  const closePreview = useMemo(
    () => previewMonthClose(budget, monthKey),
    [budget, monthKey],
  );

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

  return (
    <BudgetMonthContext.Provider value={{ monthKey, setMonthKey }}>
      <div className="mb-5 space-y-4">
        <div className="flex flex-col gap-3">
          <PillarBackLink href="/budget" label="Back to Budget" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <InlineTitle
                value={planName}
                onCommit={(next) => renamePlan(planId, next)}
                ariaLabel="Budget plan name"
              />
              <Select
                value={currency}
                onValueChange={(value) =>
                  setPlanCurrency((value ?? "USD") as BudgetCurrency)
                }
              >
                <SelectTrigger
                  size="sm"
                  className="h-8 w-[4.75rem] shrink-0 px-2 text-xs font-medium"
                  aria-label="Plan currency"
                >
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
            {isOverview ? (
              <div className="hidden flex-wrap items-center gap-2 md:flex">
                <BudgetMonthNav monthKey={monthKey} onMonthChange={setMonthKey} />
                {monthClosed ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCloseOpen(true)}
                  >
                    Close month
                  </Button>
                )}
                <BudgetAddMenu />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
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
                    "h-8 rounded-md px-3",
                    isActive && "bg-card text-foreground",
                  )}
                  render={<Link href={item.href} />}
                >
                  <item.icon className="size-3.5" />
                  {item.title}
                </Button>
              );
            })}
          </nav>
          {isOverview ? (
            <div className="flex flex-wrap items-center gap-2 md:hidden">
              <BudgetMonthNav monthKey={monthKey} onMonthChange={setMonthKey} />
              {monthClosed ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCloseOpen(true)}
                >
                  Close month
                </Button>
              )}
            </div>
          ) : null}
        </div>
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

      {isOverview ? (
        <div className="fixed right-5 bottom-[5.5rem] z-40 md:hidden">
          <BudgetAddMenu iconOnly />
        </div>
      ) : null}

      <CloseMonthDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        monthLabel={formatMonthLabel(monthKey)}
        leftover={closePreview.leftover}
        cashOverspend={closePreview.cashOverspend}
        envelopes={closePreview.envelopes}
        canClose={closePreview.canClose}
        reason={closePreview.reason}
        currency={budget.currency}
        onClose={() => {
          closeMonth(monthKey);
          setMonthKey(shiftMonthKey(monthKey, 1));
        }}
      />
    </BudgetMonthContext.Provider>
  );
}
