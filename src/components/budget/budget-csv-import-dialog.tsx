"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import { ACCOUNT_TYPE_LABELS, sortedAccounts } from "@/lib/budget/accounts";
import {
  parseBudgetCsv,
  parsedCsvToTransactionInput,
  type CsvImportPreview,
} from "@/lib/budget/csv";
import { formatBudgetDate, formatBudgetMoney } from "@/lib/budget/format";
import { cn } from "@/lib/utils";
import type { AddBudgetTransactionInput } from "@/hooks/use-budget-plan-mutations";
import type { BudgetAccount, BudgetCategory, BudgetTransaction } from "@/types/budget";

const SAMPLE_LIMIT = 8;

interface BudgetCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BudgetAccount[];
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  defaultAccountId?: string;
  onImport: (
    inputs: AddBudgetTransactionInput[],
    matches: Array<{ transactionId: string; importId: string }>,
  ) => void;
}

export function BudgetCsvImportDialog({
  open,
  onOpenChange,
  accounts,
  categories,
  transactions,
  defaultAccountId,
  onImport,
}: BudgetCsvImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orderedAccounts = useMemo(() => sortedAccounts(accounts), [accounts]);
  const fallbackDefault = defaultAccountId ?? orderedAccounts[0]?.id ?? "";

  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [accountId, setAccountId] = useState(fallbackDefault);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAccountId(fallbackDefault);
    setFileName("");
    setCsvText("");
    setFileError(null);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, fallbackDefault]);

  const preview = useMemo<CsvImportPreview | null>(() => {
    if (!csvText) return null;
    return parseBudgetCsv(csvText, {
      accounts,
      categories,
      existingTransactions: transactions,
      fallbackAccountId: accountId || undefined,
    });
  }, [accountId, accounts, categories, csvText, transactions]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type && file.type !== "text/csv") {
      setFileError("Choose a .csv file.");
      setFileName(file.name);
      setCsvText("");
      return;
    }

    try {
      const text = await file.text();
      setFileName(file.name);
      setCsvText(text);
      setFileError(null);
    } catch {
      setFileError("Could not read that file.");
      setFileName(file.name);
      setCsvText("");
    }
  }

  function handleConfirm() {
    if (!preview || preview.error) return;
    if (preview.imported.length === 0 && preview.matched.length === 0) return;
    onImport(
      preview.imported.map(parsedCsvToTransactionInput),
      preview.matched.map((row) => ({
        transactionId: row.matchedTransactionId,
        importId: row.importId,
      })),
    );
    onOpenChange(false);
  }

  const sample = preview?.imported.slice(0, SAMPLE_LIMIT) ?? [];
  const canImport = Boolean(
    preview &&
      !preview.error &&
      (preview.imported.length > 0 || preview.matched.length > 0),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="budget-dialog sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            Preview first. New rows land in the inbox unapproved.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto py-1">
          <button
            type="button"
            className="budget-dropzone w-full"
            data-active={dragActive}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              void handleFile(event.dataTransfer.files?.[0]);
            }}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-green)]/12 text-[var(--brand-green)]">
              <FileSpreadsheet className="size-5" />
            </span>
            <span className="text-sm font-semibold">
              {fileName || "Drop a CSV here"}
            </span>
            <span className="text-xs text-muted-foreground">
              or click to browse · Date + Amount, Debit/Credit, or Inflow/Outflow
            </span>
          </button>
          <input
            ref={fileInputRef}
            id="budget-csv-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          <div className="space-y-1.5">
            <Label>Import into account</Label>
            <Select
              value={accountId}
              onValueChange={(value) => setAccountId(value ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {orderedAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} · {ACCOUNT_TYPE_LABELS[account.type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used when the file has no Account column. Matching Account names
              still win per row.
            </p>
          </div>

          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {preview?.error && (
            <p className="text-sm text-destructive">{preview.error}</p>
          )}

          {preview && !preview.error && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 sm:grid-cols-4 sm:divide-y-0">
                <PreviewStat
                  label="Rows"
                  value={String(preview.totalRows)}
                  hint={fileName || undefined}
                />
                <PreviewStat
                  label="Import"
                  value={String(preview.imported.length)}
                  hint={`${preview.inflowCount} in · ${preview.outflowCount} out · ${preview.transferCount} transfer`}
                  accent="green"
                />
                <PreviewStat
                  label="Matched"
                  value={String(preview.matched.length)}
                  hint="Linked to entered rows"
                  accent={preview.matched.length > 0 ? "green" : undefined}
                />
                <PreviewStat
                  label="Skipped"
                  value={String(preview.skipped.length + preview.duplicates.length)}
                  hint={`${preview.skipped.length} bad · ${preview.duplicates.length} dup`}
                  accent={
                    preview.skipped.length + preview.duplicates.length > 0
                      ? "orange"
                      : undefined
                  }
                />
              </div>

              <p className="text-sm">
                Inflows {formatBudgetMoney(preview.inflowTotal)} · Outflows{" "}
                {formatBudgetMoney(preview.outflowTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                Exact date + payee + amount + account is skipped. Same amount and
                close dates match an existing entered row.
              </p>

              {preview.skipped.length > 0 && (
                <ul className="max-h-24 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {preview.skipped.slice(0, 8).map((row) => (
                    <li key={`${row.rowNumber}-${row.reason}`}>
                      Row {row.rowNumber}: {row.message}
                    </li>
                  ))}
                  {preview.skipped.length > 8 && (
                    <li>…and {preview.skipped.length - 8} more</li>
                  )}
                </ul>
              )}

              {sample.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Date</TableHead>
                        <TableHead>Payee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sample.map((tx) => (
                        <TableRow key={`${tx.sourceRow}-${tx.payee}`}>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatBudgetDate(tx.date)}
                          </TableCell>
                          <TableCell className="font-medium">{tx.payee}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">
                            {tx.type}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums",
                              tx.type === "inflow"
                                ? "text-[var(--brand-green)]"
                                : tx.type === "transfer"
                                  ? "text-foreground"
                                  : "text-[var(--brand-orange)]",
                            )}
                          >
                            {tx.type === "inflow" ? "+" : tx.type === "transfer" ? "↔ " : "−"}
                            {formatBudgetMoney(tx.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nothing to import from this file.
                </p>
              )}

              {preview.imported.length > SAMPLE_LIMIT && (
                <p className="text-xs text-muted-foreground">
                  Showing {SAMPLE_LIMIT} of {preview.imported.length} rows that
                  will be added.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canImport}>
            <Upload className="size-4" />
            Import {preview?.imported.length ?? 0} transaction
            {preview?.imported.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "green" | "orange";
}) {
  return (
    <div className="px-3 py-2.5">
      <p className="budget-metric-label">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          accent === "green" && "text-[var(--brand-green)]",
          accent === "orange" && "text-[var(--brand-orange)]",
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
