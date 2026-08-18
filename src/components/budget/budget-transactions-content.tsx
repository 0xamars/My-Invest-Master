"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Inbox,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { BudgetCsvImportDialog } from "@/components/budget/budget-csv-import-dialog";
import { useBudgetDialog } from "@/components/budget/budget-dialog-provider";
import { BudgetUpcomingList } from "@/components/budget/budget-upcoming-list";
import {
  BudgetEmptyState,
  BudgetKindBadge,
  BudgetPageHeader,
  BudgetPanel,
} from "@/components/budget/budget-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBudget } from "@/contexts/budget-context";
import { getRunningBalances, sortedAccounts } from "@/lib/budget/accounts";
import { formatBudgetDate, formatBudgetMoney } from "@/lib/budget/format";
import {
  getUpcomingScheduledInstances,
  todayDateKey,
} from "@/lib/budget/scheduled";
import { isReconciledState, isUnclearedState } from "@/lib/budget/cleared";
import { getTransactionDisplay } from "@/lib/budget/transactions";
import {
  filterTransactions,
  getBudgetMonthOptions,
  isTransactionApproved,
} from "@/lib/budget/reports";
import { formatMonthLabel } from "@/types/budget";
import { cn } from "@/lib/utils";

export function BudgetTransactionsContent() {
  const {
    budget,
    deleteTransaction,
    importFromCsv,
    setTransactionApproved,
    cycleTransactionCleared,
  } = useBudget();
  const { openAddTransaction, openEditTransaction, openAddScheduled, openEditScheduled } =
    useBudgetDialog();
  const [importOpen, setImportOpen] = useState(false);

  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "inflow" | "outflow" | "transfer"
  >("all");
  const [search, setSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"all" | "unapproved">("all");

  const accounts = useMemo(
    () => sortedAccounts(budget.accounts),
    [budget.accounts],
  );

  const monthOptions = useMemo(
    () => getBudgetMonthOptions(budget),
    [budget],
  );

  const filtered = useMemo(
    () =>
      filterTransactions(budget, {
        monthKey: monthFilter,
        accountId: accountFilter,
        categoryId: categoryFilter,
        type: typeFilter,
        inbox: inboxFilter,
        search,
      }),
    [
      budget,
      monthFilter,
      accountFilter,
      categoryFilter,
      typeFilter,
      inboxFilter,
      search,
    ],
  );

  const upcoming = useMemo(
    () =>
      getUpcomingScheduledInstances(budget.scheduledTransactions, {
        fromDate: todayDateKey(),
        horizonDays: 60,
        limitPerSchedule: 2,
      }).filter((instance) => {
        if (monthFilter !== "all" && !instance.date.startsWith(monthFilter)) {
          return false;
        }
        if (
          accountFilter !== "all" &&
          instance.accountId !== accountFilter &&
          instance.transferAccountId !== accountFilter
        ) {
          return false;
        }
        if (typeFilter !== "all" && instance.type !== typeFilter) {
          return false;
        }
        if (categoryFilter !== "all") {
          const paymentAccountId = budget.categories.find(
            (category) => category.id === categoryFilter,
          )?.creditCardAccountId;
          if (paymentAccountId) {
            if (
              instance.accountId !== paymentAccountId &&
              instance.transferAccountId !== paymentAccountId
            ) {
              return false;
            }
          } else if (
            instance.categoryId !== categoryFilter &&
            !instance.splits?.some((line) => line.categoryId === categoryFilter)
          ) {
            return false;
          }
        }
        const query = search.trim().toLowerCase();
        if (
          query &&
          !instance.payee.toLowerCase().includes(query) &&
          !(instance.memo?.toLowerCase().includes(query) ?? false)
        ) {
          return false;
        }
        return true;
      }),
    [
      budget.scheduledTransactions,
      budget.categories,
      monthFilter,
      accountFilter,
      categoryFilter,
      typeFilter,
      search,
    ],
  );

  const runningBalanceByTxId = useMemo(() => {
    if (accountFilter === "all") return new Map<string, number>();

    const account = budget.accounts.find((entry) => entry.id === accountFilter);
    if (!account) return new Map<string, number>();

    return new Map(
      getRunningBalances(account, budget.transactions).map((row) => [
        row.transaction.id,
        row.runningBalance,
      ]),
    );
  }, [accountFilter, budget.accounts, budget.transactions]);

  function accountName(accountId: string): string {
    return (
      budget.accounts.find((account) => account.id === accountId)?.name ??
      "Unknown"
    );
  }

  const viewingAccountId =
    accountFilter === "all" ? undefined : accountFilter;

  const showRunningBalance = accountFilter !== "all";
  const hasAnyTransactions = budget.transactions.length > 0;
  const inboxCount = budget.transactions.filter(
    (tx) => !isTransactionApproved(tx),
  ).length;
  const filtersActive =
    monthFilter !== "all" ||
    accountFilter !== "all" ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    inboxFilter !== "all" ||
    search.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BudgetPageHeader
        title="Register"
        description="Income, spending, and transfers. Import a bank or YNAB-style CSV, then categorize later."
        action={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-4" />
              Import CSV
            </Button>
            <Button type="button" variant="outline" onClick={openAddScheduled}>
              <CalendarClock className="size-4" />
              Schedule
            </Button>
            <Button type="button" onClick={openAddTransaction}>
              <Plus className="size-4" />
              Add
            </Button>
          </>
        }
      />

      <BudgetUpcomingList
        instances={upcoming}
        accounts={budget.accounts}
        categories={budget.categories}
        onEdit={openEditScheduled}
      />

      <BudgetPanel>
        <div className="grid gap-2 border-b border-border/50 p-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search payee or notes…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={accountFilter}
            onValueChange={(value) => setAccountFilter(value ?? "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={monthFilter}
            onValueChange={(value) => setMonthFilter(value ?? "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {monthOptions.map((monthKey) => (
                <SelectItem key={monthKey} value={monthKey}>
                  {formatMonthLabel(monthKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(value) => setCategoryFilter(value ?? "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {budget.categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={typeFilter}
            onValueChange={(value) =>
              setTypeFilter(
                (value ?? "all") as "all" | "inflow" | "outflow" | "transfer",
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="inflow">Inflow</SelectItem>
              <SelectItem value="outflow">Outflow</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={inboxFilter}
            onValueChange={(value) =>
              setInboxFilter((value ?? "all") as "all" | "unapproved")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Inbox" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All transactions</SelectItem>
              <SelectItem value="unapproved">
                Inbox{inboxCount > 0 ? ` (${inboxCount})` : ""}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <BudgetEmptyState
            icon={hasAnyTransactions ? <Search className="size-5" /> : <Upload className="size-5" />}
            title={
              hasAnyTransactions || filtersActive
                ? "Nothing matches"
                : "The register is empty"
            }
            description={
              hasAnyTransactions || filtersActive
                ? "Try a different account, month, or search."
                : "Import a bank CSV or add the first transaction. Uncategorized outflows are fine."
            }
            actions={
              !hasAnyTransactions && !filtersActive ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="size-4" />
                    Import CSV
                  </Button>
                  <Button type="button" onClick={openAddTransaction}>
                    <Plus className="size-4" />
                    Add transaction
                  </Button>
                </>
              ) : undefined
            }
          />
        ) : (
          <div className="max-h-[min(70vh,44rem)] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card/95 shadow-[0_1px_0_var(--border)] backdrop-blur-sm">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 bg-transparent" />
                  <TableHead className="bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Payee
                  </TableHead>
                  <TableHead className="bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Account
                  </TableHead>
                  <TableHead className="bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Category
                  </TableHead>
                  <TableHead className="bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Notes
                  </TableHead>
                  <TableHead className="bg-transparent text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Amount
                  </TableHead>
                  {showRunningBalance && (
                    <TableHead className="bg-transparent text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Balance
                    </TableHead>
                  )}
                  <TableHead className="w-20 bg-transparent" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx) => {
                  const display = getTransactionDisplay(
                    tx,
                    budget.accounts,
                    budget.categories,
                    viewingAccountId,
                  );
                  const accountLabel =
                    tx.type === "transfer" && tx.transferAccountId
                      ? `${accountName(tx.accountId)} → ${accountName(tx.transferAccountId)}`
                      : accountName(tx.accountId);

                  return (
                    <TableRow key={tx.id} className="hover:bg-muted/30">
                      <TableCell className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={isReconciledState(tx.cleared)}
                          onClick={() => cycleTransactionCleared(tx.id)}
                          aria-label={
                            isReconciledState(tx.cleared)
                              ? `${display.payee} is reconciled and locked`
                              : isUnclearedState(tx.cleared)
                                ? `Mark ${display.payee} as cleared`
                                : `Mark ${display.payee} as uncleared`
                          }
                          aria-pressed={!isUnclearedState(tx.cleared)}
                        >
                          {isReconciledState(tx.cleared) ? (
                            <Lock className="size-3.5 text-[var(--brand-green)]" />
                          ) : (
                            <CheckCircle2
                              className={cn(
                                "size-3.5",
                                isUnclearedState(tx.cleared)
                                  ? "text-muted-foreground/40"
                                  : "text-[var(--brand-green)]",
                              )}
                            />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="py-2 whitespace-nowrap text-muted-foreground">
                        {formatBudgetDate(tx.date)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{display.payee}</span>
                          {tx.scheduledTransactionId ? (
                            <BudgetKindBadge kind="scheduled" />
                          ) : null}
                          {display.isTransfer ? (
                            <BudgetKindBadge kind="transfer" />
                          ) : null}
                          {display.isSplit ? <BudgetKindBadge kind="split" /> : null}
                          {!isTransactionApproved(tx) ? (
                            <BudgetKindBadge kind="inbox" />
                          ) : null}
                          {tx.matchedTransactionId ? (
                            <BudgetKindBadge kind="matched" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-muted-foreground">
                        {accountLabel}
                      </TableCell>
                      <TableCell className="py-2 text-muted-foreground">
                        {display.categoryLabel}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate py-2 text-muted-foreground">
                        {tx.memo ?? "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "py-2 text-right font-semibold tabular-nums",
                          display.isTransfer
                            ? "text-foreground"
                            : display.isInflowLike
                              ? "text-[var(--brand-green)]"
                              : "text-[var(--brand-orange)]",
                        )}
                      >
                        {display.amountPrefix}
                        {display.amountPrefix ? "" : display.isTransfer ? "↔ " : ""}
                        {formatBudgetMoney(tx.amount, budget.currency)}
                      </TableCell>
                      {showRunningBalance && (
                        <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                          {formatBudgetMoney(
                            runningBalanceByTxId.get(tx.id) ?? 0,
                            budget.currency,
                          )}
                        </TableCell>
                      )}
                      <TableCell className="py-2">
                        <div className="flex justify-end gap-0.5">
                          {!isTransactionApproved(tx) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setTransactionApproved(tx.id, true)}
                              aria-label={`Approve ${display.payee}`}
                            >
                              <Inbox className="size-3.5 text-[var(--brand-orange)]" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditTransaction(tx.id)}
                            aria-label={`Edit ${display.payee}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => deleteTransaction(tx.id)}
                            aria-label={`Delete ${display.payee}`}
                          >
                            <Trash2 className="size-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </BudgetPanel>

      <BudgetCsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        accounts={budget.accounts}
        categories={budget.categories}
        transactions={budget.transactions}
        defaultAccountId={
          accountFilter === "all" ? budget.accounts[0]?.id : accountFilter
        }
        onImport={(inputs, matches) => importFromCsv(inputs, matches)}
      />
    </div>
  );
}
