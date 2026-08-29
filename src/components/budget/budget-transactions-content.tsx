"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarClock,
  Check,
  Inbox,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
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
import { lastImportedTransactionDate } from "@/lib/budget/habit";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BudgetTransactionsContent() {
  const {
    budget,
    deleteTransaction,
    importFromCsv,
    setTransactionApproved,
    cycleTransactionCleared,
    bulkCategorizeTransactions,
    bulkApproveTransactions,
    bulkDeleteTransactions,
    bulkToggleClearedTransactions,
    enterScheduledTransactionNow,
  } = useBudget();
  const { openAddTransaction, openEditTransaction, openAddScheduled, openEditScheduled } =
    useBudgetDialog();
  const searchParams = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "inflow" | "outflow" | "transfer"
  >("all");
  const [search, setSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"all" | "unapproved">("all");
  const [payeeFilter, setPayeeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const category = searchParams.get("category");
    const payee = searchParams.get("payee");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const month = searchParams.get("month");
    const inbox = searchParams.get("inbox");
    if (category) setCategoryFilter(category);
    if (payee) setPayeeFilter(payee);
    if (from) setFromDate(from);
    if (to) setToDate(to);
    if (from || to) setMonthFilter("all");
    else if (month) setMonthFilter(month);
    if (inbox === "unapproved") setInboxFilter("unapproved");
  }, [searchParams]);

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
        payee: payeeFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    [
      budget,
      monthFilter,
      accountFilter,
      categoryFilter,
      typeFilter,
      inboxFilter,
      search,
      payeeFilter,
      fromDate,
      toDate,
    ],
  );

  const visibleIds = useMemo(() => filtered.map((tx) => tx.id), [filtered]);
  const selectedVisible = useMemo(
    () => selectedIds.filter((id) => visibleIds.includes(id)),
    [selectedIds, visibleIds],
  );
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

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

  function toggleSelected(id: string, shiftKey: boolean) {
    if (shiftKey && lastSelectedId) {
      const start = visibleIds.indexOf(lastSelectedId);
      const end = visibleIds.indexOf(id);
      if (start >= 0 && end >= 0) {
        const from = Math.min(start, end);
        const to = Math.max(start, end);
        const range = visibleIds.slice(from, to + 1);
        setSelectedIds((current) => [...new Set([...current, ...range])]);
        setLastSelectedId(id);
        return;
      }
    }
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
    setLastSelectedId(id);
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
    }
  }

  const viewingAccountId =
    accountFilter === "all" ? undefined : accountFilter;

  const showRunningBalance = accountFilter !== "all";
  const hasAnyTransactions = budget.transactions.length > 0;
  const lastImportedDate = lastImportedTransactionDate(budget);
  const inboxCount = budget.transactions.filter(
    (tx) => !isTransactionApproved(tx),
  ).length;
  const filtersActive =
    monthFilter !== "all" ||
    accountFilter !== "all" ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    inboxFilter !== "all" ||
    payeeFilter.trim().length > 0 ||
    fromDate.length > 0 ||
    toDate.length > 0 ||
    search.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BudgetPageHeader
        title="Register"
        description={
          lastImportedDate
            ? `Income, spending, and transfers. Latest imported row dated ${formatBudgetDate(lastImportedDate)}.`
            : "Income, spending, and transfers. Import a bank CSV, then categorize later."
        }
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
        onEnterNow={enterScheduledTransactionNow}
      />

      <BudgetPanel>
        {inboxCount > 0 ? (
          <div className="budget-inbox-banner">
            <div>
              <p className="text-sm font-semibold">{inboxCount} to approve</p>
              <p className="text-xs text-muted-foreground">
                Imported rows waiting for an envelope and a check.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={inboxFilter === "unapproved" ? "default" : "outline"}
              onClick={() =>
                setInboxFilter(inboxFilter === "unapproved" ? "all" : "unapproved")
              }
            >
              <Inbox className="size-3.5" />
              {inboxFilter === "unapproved" ? "Show all" : "Review inbox"}
            </Button>
          </div>
        ) : null}

        {selectedVisible.length > 0 ? (
          <div className="budget-bulk-bar">
            <div>
              <p className="text-sm font-semibold">
                {selectedVisible.length} selected
              </p>
              <p className="text-xs text-muted-foreground">
                Categorize, approve, clear, or delete. Reconciled stay locked.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                onValueChange={(value) => {
                  if (typeof value !== "string") return;
                  bulkCategorizeTransactions(
                    selectedVisible,
                    value === "uncategorized" ? null : value,
                  );
                }}
              >
                <SelectTrigger className="h-7 w-[10.5rem] text-xs" size="sm">
                  <SelectValue placeholder="Categorize" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {budget.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={() => bulkApproveTransactions(selectedVisible)}
              >
                <Check className="size-3.5" />
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => bulkToggleClearedTransactions(selectedVisible)}
              >
                Toggle cleared
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedIds([]);
                  setLastSelectedId(null);
                }}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {(payeeFilter || fromDate || toDate) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-3 py-2">
            {payeeFilter ? (
              <button
                type="button"
                className="budget-filter-chip"
                onClick={() => setPayeeFilter("")}
              >
                Payee: {payeeFilter}
                <X className="size-3" />
              </button>
            ) : null}
            {fromDate || toDate ? (
              <button
                type="button"
                className="budget-filter-chip"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
              >
                {fromDate || "…"} – {toDate || "…"}
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        )}

        <div className="grid gap-2 border-b border-border/50 p-3 md:grid-cols-2 xl:grid-cols-5">
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
            onValueChange={(value) => {
              setMonthFilter(value ?? "all");
              setFromDate("");
              setToDate("");
            }}
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
              <SelectValue placeholder="Envelope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All envelopes</SelectItem>
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
        </div>

        {filtered.length === 0 ? (
          inboxFilter === "unapproved" ? (
            <BudgetEmptyState
              icon={<Inbox className="size-5" />}
              title="Inbox is clear"
              description="Imported rows to approve will show up here."
              actions={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInboxFilter("all")}
                >
                  Show all transactions
                </Button>
              }
            />
          ) : (
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
          )
        ) : (
          <div
            className="max-h-[min(70vh,44rem)] overflow-auto"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSelectedIds([]);
                setLastSelectedId(null);
              }
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
                event.preventDefault();
                setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
              }
            }}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card/95 shadow-[0_1px_0_var(--border)]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 bg-transparent">
                    <input
                      type="checkbox"
                      className="budget-check"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible transactions"
                    />
                  </TableHead>
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
                    Envelope
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

                  const reconciled = isReconciledState(tx.cleared);
                  const uncleared = isUnclearedState(tx.cleared);
                  const approved = isTransactionApproved(tx);

                  return (
                    <TableRow
                      key={tx.id}
                      data-selected={selectedIds.includes(tx.id)}
                      className={cn(
                        "budget-register-row hover:bg-muted/30",
                        reconciled && "budget-register-row--reconciled",
                        selectedIds.includes(tx.id) && "budget-register-row--selected",
                      )}
                    >
                      <TableCell className="py-2">
                        <input
                          type="checkbox"
                          className="budget-check"
                          checked={selectedIds.includes(tx.id)}
                          onChange={(event) =>
                            toggleSelected(tx.id, (event.nativeEvent as MouseEvent).shiftKey)
                          }
                          onClick={(event) => {
                            if (event.shiftKey) event.preventDefault();
                          }}
                          aria-label={`Select ${display.payee}`}
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={reconciled}
                          onClick={() => cycleTransactionCleared(tx.id)}
                          aria-label={
                            reconciled
                              ? `${display.payee} is reconciled and locked`
                              : uncleared
                                ? `Mark ${display.payee} as cleared`
                                : `Mark ${display.payee} as uncleared`
                          }
                          aria-pressed={!uncleared}
                        >
                          {reconciled ? (
                            <Lock className="size-3.5 text-muted-foreground" />
                          ) : uncleared ? (
                            <span className="budget-cleared-dot" />
                          ) : (
                            <span className="budget-cleared-dot budget-cleared-dot--cleared" />
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
                          {!approved ? (
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
                        <div className="flex justify-end gap-1">
                          {!approved ? (
                            <Button
                              type="button"
                              size="xs"
                              onClick={() => setTransactionApproved(tx.id, true)}
                            >
                              Approve
                            </Button>
                          ) : null}
                          <div className="budget-row-actions flex gap-0.5">
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

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="budget-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete selected</DialogTitle>
            <DialogDescription>
              Delete {selectedVisible.length} transaction
              {selectedVisible.length === 1 ? "" : "s"} from the register.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                bulkDeleteTransactions(selectedVisible);
                setSelectedIds([]);
                setLastSelectedId(null);
                setBulkDeleteOpen(false);
              }}
            >
              Delete {selectedVisible.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
