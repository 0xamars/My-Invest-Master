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
  type ParsedCsvTransaction,
} from "@/lib/budget/csv";
import { CSV_PRESET_IDS, CSV_PRESETS, type CsvPresetId } from "@/lib/budget/csv-presets";
import { formatBudgetDate, formatBudgetMoney } from "@/lib/budget/format";
import { detectBudgetImportKind, parseBudgetOfx } from "@/lib/budget/ofx";
import { cn } from "@/lib/utils";
import type { AddBudgetTransactionInput } from "@/hooks/use-budget-plan-mutations";
import { applyPayeeRulesToTransaction } from "@/lib/budget/payee-rules";
import { normalizePayeeName } from "@/lib/budget/payees";
import type {
  BudgetAccount,
  BudgetCategory,
  BudgetCurrency,
  BudgetTransaction,
  PayeeRule,
} from "@/types/budget";

const SAMPLE_LIMIT = 8;

interface BudgetCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BudgetAccount[];
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  payeeRules?: PayeeRule[];
  defaultAccountId?: string;
  currency?: BudgetCurrency;
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
  payeeRules = [],
  defaultAccountId,
  currency,
  onImport,
}: BudgetCsvImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orderedAccounts = useMemo(() => sortedAccounts(accounts), [accounts]);
  const fallbackDefault = defaultAccountId ?? orderedAccounts[0]?.id ?? "";

  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [fileKind, setFileKind] = useState<"csv" | "ofx" | null>(null);
  const [preset, setPreset] = useState<CsvPresetId>("auto");
  const [accountId, setAccountId] = useState(fallbackDefault);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAccountId(fallbackDefault);
    setFileName("");
    setFileText("");
    setFileKind(null);
    setPreset("auto");
    setFileError(null);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, fallbackDefault]);

  const preview = useMemo<CsvImportPreview | null>(() => {
    if (!fileText || !fileKind) return null;
    const shared = {
      accounts,
      categories,
      existingTransactions: transactions,
      fallbackAccountId: accountId || undefined,
      currency,
    };
    if (fileKind === "ofx") {
      return parseBudgetOfx(fileText, { ...shared, fileName });
    }
    return parseBudgetCsv(fileText, { ...shared, preset });
  }, [
    accountId,
    accounts,
    categories,
    currency,
    fileKind,
    fileName,
    fileText,
    preset,
    transactions,
  ]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const detected = detectBudgetImportKind(file.name, text);
      setFileName(file.name);
      if (detected.kind === "rejected") {
        setFileError(detected.error);
        setFileText("");
        setFileKind(null);
        return;
      }
      setFileKind(detected.kind);
      setFileText(text);
      setFileError(null);
    } catch {
      setFileError("Could not read that file.");
      setFileName(file.name);
      setFileText("");
      setFileKind(null);
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
        payee: row.payee,
      })),
    );
    onOpenChange(false);
  }

  function cleanedPayee(row: { date: string; payee: string; accountId: string; categoryId: string | null; amount: number; type: ParsedCsvTransaction["type"]; memo?: string; sourceRow: number }) {
    const resolved = applyPayeeRulesToTransaction(
      {
        id: `preview-${row.sourceRow}`,
        date: row.date,
        payee: row.payee,
        accountId: row.accountId,
        categoryId: row.type === "outflow" ? row.categoryId : null,
        amount: row.amount,
        type: row.type,
        cleared: "uncleared",
        memo: row.memo,
      },
      payeeRules,
      transactions,
      {
        matchText: row.payee,
        recordOriginal: true,
        preserveCategory: Boolean(row.categoryId),
        categories,
      },
    );
    return resolved;
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
          <DialogTitle>Import transactions</DialogTitle>
          <DialogDescription>
            Pick a CSV, OFX, or QFX file and the account it belongs to. Preview
            first. New rows land in the inbox unapproved, ready to categorize
            and reconcile.
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
              {fileName || "Drop a CSV, OFX, or QFX file"}
            </span>
            <span className="text-xs text-muted-foreground">
              or click to browse · Canadian bank CSV, OFX, or QFX
            </span>
          </button>
          <input
            ref={fileInputRef}
            id="budget-import-file"
            type="file"
            accept=".csv,.ofx,.qfx,.qbo,text/csv,application/x-ofx,application/vnd.intu.qfx"
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
              Every row imports here unless the file names an account that
              matches one in this budget.
            </p>
          </div>

          {fileKind === "csv" && (
            <div className="space-y-1.5">
              <Label>Bank format</Label>
              <Select
                value={preset}
                onValueChange={(value) => {
                  if (value && (CSV_PRESET_IDS as readonly string[]).includes(value)) {
                    setPreset(value as CsvPresetId);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  {CSV_PRESET_IDS.filter(
                    (id): id is Exclude<CsvPresetId, "auto"> => id !== "auto",
                  ).map((id) => (
                    <SelectItem key={id} value={id}>
                      {CSV_PRESETS[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {preview?.formatLabel
                  ? `Reading this file as ${preview.formatLabel}.`
                  : "Auto-detect matches RBC, TD, Scotiabank, BMO, CIBC, Tangerine, Simplii, and common card files. Pick EQ Bank when that export does not name itself."}
              </p>
            </div>
          )}

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
              {preview.formatNote && (
                <p className="text-xs text-muted-foreground">{preview.formatNote}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The same file, or an overlap, is skipped. OFX and QFX use FITID
                when the bank sends one. A row already imported from a linked
                account is skipped when the amount, account, and date line up.
                Close dates on a hand-entered row stay on that row.
                {payeeRules.some((rule) => rule.enabled)
                  ? " Payee rules rename matching rows and fill an empty category."
                  : ""}
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
                      {sample.map((tx) => {
                        const cleaned = cleanedPayee(tx);
                        const showBank =
                          cleaned.originalPayee &&
                          normalizePayeeName(cleaned.originalPayee) !==
                            normalizePayeeName(cleaned.payee);
                        return (
                        <TableRow key={`${tx.sourceRow}-${tx.payee}`}>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatBudgetDate(tx.date)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {cleaned.payee}
                            {showBank ? (
                              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                Bank: {cleaned.originalPayee}
                              </span>
                            ) : null}
                          </TableCell>
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
                        );
                      })}
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
