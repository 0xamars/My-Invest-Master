"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { BudgetCsvImportDialog } from "@/components/budget/budget-csv-import-dialog";
import { useBudgetDialog } from "@/components/budget/budget-dialog-provider";
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
import { getTransactionDisplay } from "@/lib/budget/transactions";
import {
  filterTransactions,
  getBudgetMonthOptions,
} from "@/lib/budget/reports";
import { formatMonthLabel } from "@/types/budget";
import { cn } from "@/lib/utils";

export function BudgetTransactionsContent() {
  const { budget, deleteTransaction, importTransactions, setTransactionCleared } =
    useBudget();
  const { openAddTransaction, openEditTransaction } = useBudgetDialog();
  const [importOpen, setImportOpen] = useState(false);

  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "inflow" | "outflow" | "transfer"
  >("all");
  const [search, setSearch] = useState("");

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
        search,
      }),
    [budget, monthFilter, accountFilter, categoryFilter, typeFilter, search],
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
  const filtersActive =
    monthFilter !== "all" ||
    accountFilter !== "all" ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
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
            <Button type="button" onClick={openAddTransaction}>
              <Plus className="size-4" />
              Add
            </Button>
          </>
        }
      />

      <BudgetPanel>
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
                          onClick={() => setTransactionCleared(tx.id, !tx.cleared)}
                          aria-label={
                            tx.cleared
                              ? `Mark ${display.payee} as uncleared`
                              : `Mark ${display.payee} as cleared`
                          }
                          aria-pressed={tx.cleared}
                        >
                          <CheckCircle2
                            className={cn(
                              "size-3.5",
                              tx.cleared
                                ? "text-[var(--brand-green)]"
                                : "text-muted-foreground/40",
                            )}
                          />
                        </Button>
                      </TableCell>
                      <TableCell className="py-2 whitespace-nowrap text-muted-foreground">
                        {formatBudgetDate(tx.date)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{display.payee}</span>
                          {display.isTransfer ? (
                            <BudgetKindBadge kind="transfer" />
                          ) : null}
                          {display.isSplit ? <BudgetKindBadge kind="split" /> : null}
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
                        {formatBudgetMoney(tx.amount)}
                      </TableCell>
                      {showRunningBalance && (
                        <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                          {formatBudgetMoney(
                            runningBalanceByTxId.get(tx.id) ?? 0,
                          )}
                        </TableCell>
                      )}
                      <TableCell className="py-2">
                        <div className="flex justify-end gap-0.5">
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
        onImport={importTransactions}
      />
    </div>
  );
}
