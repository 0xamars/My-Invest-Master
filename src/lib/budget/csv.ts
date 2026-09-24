import { isOnBudgetAccount } from "@/lib/budget/accounts";
import { clearedStateFromCsvFlag } from "@/lib/budget/cleared";
import {
  resolveCsvPreset,
  type CsvPresetId,
  type CsvSignMode,
  type HeaderlessKind,
} from "@/lib/budget/csv-presets";
import type {
  BudgetAccount,
  BudgetCategory,
  BudgetCurrency,
  BudgetTransaction,
  BudgetTransactionType,
} from "@/types/budget";

export const IMPORT_MATCH_DAY_WINDOW = 5;

/**
 * Dedup key for CSV import: date + normalized payee + amount (cents) + account.
 * Same file imported twice will skip matching rows instead of doubling them.
 */
export function budgetImportDedupeKey(tx: {
  date: string;
  payee: string;
  amount: number;
  accountId: string;
}): string {
  const payee = tx.payee.trim().toLowerCase().replace(/\s+/g, " ");
  const cents = Math.round(Math.abs(tx.amount) * 100);
  return `${tx.date}|${payee}|${cents}|${tx.accountId}`;
}

export function budgetImportId(tx: {
  date: string;
  payee: string;
  amount: number;
  accountId: string;
}): string {
  return `csv:${budgetImportDedupeKey(tx)}`;
}

/** FITID when the file has one; otherwise the CSV fallback key. */
export function fileImportId(tx: {
  date: string;
  payee: string;
  amount: number;
  accountId: string;
  externalId?: string;
}): string {
  const fit = tx.externalId?.trim();
  if (fit) return `ofx:${fit}`;
  return budgetImportId(tx);
}

export function daysBetweenDateKeys(a: string, b: string): number {
  const start = Date.parse(`${a}T12:00:00Z`);
  const end = Date.parse(`${b}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((end - start) / 86_400_000));
}

function sameTransferPair(
  row: Pick<ParsedCsvTransaction, "accountId" | "transferAccountId">,
  tx: Pick<BudgetTransaction, "accountId" | "transferAccountId">,
): boolean {
  const rowTo = row.transferAccountId;
  const txTo = tx.transferAccountId;
  if (!rowTo || !txTo) {
    return tx.accountId === row.accountId;
  }
  return (
    (tx.accountId === row.accountId && txTo === rowTo) ||
    (tx.accountId === rowTo && txTo === row.accountId)
  );
}

export function findImportMatch(
  row: Pick<ParsedCsvTransaction, "date" | "amount" | "accountId" | "type" | "transferAccountId">,
  existing: ParseBudgetCsvOptions["existingTransactions"],
  usedMatchIds: Set<string>,
): string | undefined {
  const cents = Math.round(Math.abs(row.amount) * 100);
  const candidates = existing.filter((tx) => {
    if (!tx.id || usedMatchIds.has(tx.id)) return false;
    if (tx.importId) return false;
    if (Math.round(Math.abs(tx.amount) * 100) !== cents) return false;
    if (daysBetweenDateKeys(tx.date, row.date) > IMPORT_MATCH_DAY_WINDOW) {
      return false;
    }
    if (row.type === "transfer") {
      if (tx.type && tx.type !== "transfer") return false;
      return sameTransferPair(row, tx);
    }
    if (tx.accountId !== row.accountId) return false;
    if (tx.type && tx.type !== row.type) return false;
    return true;
  });

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => {
    const dateDelta =
      daysBetweenDateKeys(a.date, row.date) - daysBetweenDateKeys(b.date, row.date);
    if (dateDelta !== 0) return dateDelta;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });

  return candidates[0]?.id;
}

export type CsvSkipReason =
  | "empty-row"
  | "missing-date"
  | "invalid-date"
  | "missing-amount"
  | "invalid-amount"
  | "zero-amount"
  | "ambiguous-amount"
  | "missing-payee"
  | "unknown-account"
  | "missing-account"
  | "currency-mismatch";

export interface ParsedCsvTransaction {
  date: string;
  payee: string;
  accountId: string;
  categoryId: string | null;
  amount: number;
  type: BudgetTransactionType;
  cleared: boolean;
  memo?: string;
  sourceRow: number;
  importId: string;
  /** OFX/QFX FITID. Distinct ids are kept even when date, payee, and amount match. */
  externalId?: string;
  transferAccountId?: string;
}

export interface CsvMatchedTransaction extends ParsedCsvTransaction {
  matchedTransactionId: string;
}

export interface CsvSkippedRow {
  rowNumber: number;
  reason: CsvSkipReason;
  message: string;
}

export interface CsvImportPreview {
  totalRows: number;
  imported: ParsedCsvTransaction[];
  duplicates: ParsedCsvTransaction[];
  matched: CsvMatchedTransaction[];
  skipped: CsvSkippedRow[];
  inflowCount: number;
  outflowCount: number;
  transferCount: number;
  inflowTotal: number;
  outflowTotal: number;
  hasAccountColumn: boolean;
  hasCategoryColumn: boolean;
  detectedColumns: string[];
  notes: string[];
  /** Preset that parsed a CSV, when one was selected or detected. */
  presetId?: string;
  formatLabel: string;
  formatNote?: string;
  error?: string;
}

export interface ParseBudgetCsvOptions {
  accounts: Pick<BudgetAccount, "id" | "name" | "onBudget">[];
  categories: Pick<BudgetCategory, "id" | "name">[];
  existingTransactions: Array<
    Pick<BudgetTransaction, "date" | "payee" | "amount" | "accountId"> &
      Partial<
        Pick<BudgetTransaction, "id" | "type" | "importId" | "transferAccountId">
      >
  >;
  fallbackAccountId?: string;
  /** Bank/card layout. Omit or "auto" to detect from the header. */
  preset?: CsvPresetId;
  /** Plan currency. When set, a file in another currency is rejected. */
  currency?: BudgetCurrency;
}

const DATE_HEADERS = [
  "date",
  "transaction date",
  "posted date",
  "posting date",
  "trans date",
  "date posted",
  "transfer date",
];
const PAYEE_HEADERS = [
  "payee",
  "description 1",
  "description",
  "transaction details",
  "transaction description",
  "name",
  "merchant",
  "narrative",
  "transaction",
];
const AMOUNT_HEADERS = ["amount", "transaction amount", "amt"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals", "funds out"];
const CREDIT_HEADERS = ["credit", "deposit", "deposits", "funds in"];
const OUTFLOW_HEADERS = ["outflow"];
const INFLOW_HEADERS = ["inflow"];
const MEMO_HEADERS = ["memo", "notes", "note", "comment", "comments"];
const CATEGORY_HEADERS = ["category", "category group category"];
const ACCOUNT_HEADERS = ["account", "account name"];
const CLEARED_HEADERS = ["cleared", "cleared status"];
const TYPE_HEADERS = ["type", "transaction type", "cr dr"];

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function normalizeCsvHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseCsvRows(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }

    if (ch === "\r") {
      if (src[i + 1] === "\n") {
        i += 1;
        continue;
      }
      pushRow();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

export function parseBudgetMoney(raw: string): number | null {
  let value = raw.trim();
  if (!value) return null;

  const wrapped = /^\((.*)\)$/.exec(value);
  const negativeParens = Boolean(wrapped);
  if (wrapped) value = wrapped[1].trim();

  value = value.replace(/^[+\-]\s*/, (match) => match.trim());
  const leadingSign = raw.trim().startsWith("-") ? -1 : 1;

  value = value.replace(/[^\d.,\-]/g, "");
  if (!value || value === "-" || value === "." || value === ",") return null;

  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(value)) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else {
    value = value.replace(/,/g, "");
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;

  const signed = (negativeParens ? -1 : leadingSign) * Math.abs(parsed);
  return Math.round(signed * 100) / 100;
}

function expandYear(year: number): number {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

function ymd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseBudgetDate(
  raw: string,
  order: "mdy" | "dmy" = "mdy",
): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) {
    return ymd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const ymdSlash = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(value);
  if (ymdSlash) {
    return ymd(Number(ymdSlash[1]), Number(ymdSlash[2]), Number(ymdSlash[3]));
  }

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (compact) {
    return ymd(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  }

  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(value);
  if (us) {
    const first = Number(us[1]);
    const second = Number(us[2]);
    let month = order === "dmy" ? second : first;
    let day = order === "dmy" ? first : second;
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    }
    return ymd(expandYear(Number(us[3])), month, day);
  }

  const named =
    /^(\d{1,2})[-\s]+([A-Za-z]{3,9})[-\s,]+(\d{2}|\d{4})$/.exec(value) ??
    /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2}|\d{4})$/.exec(value);
  if (named) {
    const firstIsDay = /^\d/.test(named[1]);
    const monthName = (firstIsDay ? named[2] : named[1]).toLowerCase();
    const month = MONTH_NAMES[monthName];
    if (!month) return null;
    const day = Number(firstIsDay ? named[1] : named[2]);
    const year = expandYear(Number(named[3]));
    return ymd(year, month, day);
  }

  return null;
}

function findColumn(
  headers: string[],
  aliases: string[],
): number | undefined {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index >= 0) return index;
  }
  return undefined;
}

function cell(row: string[], index: number | undefined): string {
  if (index == null) return "";
  return (row[index] ?? "").trim();
}

function matchAccountId(
  name: string,
  accounts: ParseBudgetCsvOptions["accounts"],
): string | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return accounts.find((account) => account.name.trim().toLowerCase() === needle)
    ?.id;
}

function matchCategoryId(
  name: string,
  categories: ParseBudgetCsvOptions["categories"],
): string | null {
  const raw = name.trim();
  if (!raw) return null;

  const exact = categories.find(
    (category) => category.name.trim().toLowerCase() === raw.toLowerCase(),
  );
  if (exact) return exact.id;

  const nested = raw.includes(":")
    ? raw.split(":").pop()
    : raw.includes("/")
      ? raw.split("/").pop()
      : undefined;
  if (nested) {
    const nestedName = nested.trim().toLowerCase();
    const match = categories.find(
      (category) => category.name.trim().toLowerCase() === nestedName,
    );
    if (match) return match.id;
  }

  return null;
}

function parseCleared(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return ["cleared", "reconciled", "c", "r", "yes", "true", "y", "*", "x"].includes(
    value,
  );
}

function classifyTypeHint(
  raw: string,
  mode: CsvSignMode = "bank",
): "inflow" | "outflow" | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (mode === "card" && /payment|refund|return/.test(value) && !/debit/.test(value)) {
    return "inflow";
  }
  if (
    /debit|withdrawal|purchase|sale|pos|spend|payment(?!\s*received)/.test(value)
  ) {
    return "outflow";
  }
  if (/credit|deposit|payroll|income|refund/.test(value)) {
    return "inflow";
  }
  return null;
}

function looksLikeTransferPayee(payee: string): boolean {
  return /^transfer(\s+to|\s+from|\s*:)/i.test(payee.trim());
}

function csvAccountOnBudget(
  account: ParseBudgetCsvOptions["accounts"][number] | undefined,
): boolean {
  return isOnBudgetAccount(account);
}

function matchOnBudgetAccountId(
  name: string,
  accounts: ParseBudgetCsvOptions["accounts"],
): string | undefined {
  const accountId = matchAccountId(name, accounts);
  if (!accountId) return undefined;
  const account = accounts.find((entry) => entry.id === accountId);
  return csvAccountOnBudget(account) ? accountId : undefined;
}

export function parseTransferCounterpart(
  payee: string,
  accounts: ParseBudgetCsvOptions["accounts"],
): { otherAccountId: string; direction: "to" | "from" | "named" } | undefined {
  const raw = payee.trim();
  const toMatch = /^transfer\s+to\s+(.+)$/i.exec(raw);
  if (toMatch) {
    const otherAccountId = matchOnBudgetAccountId(toMatch[1], accounts);
    return otherAccountId
      ? { otherAccountId, direction: "to" }
      : undefined;
  }
  const fromMatch = /^transfer\s+from\s+(.+)$/i.exec(raw);
  if (fromMatch) {
    const otherAccountId = matchOnBudgetAccountId(fromMatch[1], accounts);
    return otherAccountId
      ? { otherAccountId, direction: "from" }
      : undefined;
  }
  const namedMatch = /^transfer\s*:\s*(.+)$/i.exec(raw);
  if (namedMatch) {
    const otherAccountId = matchOnBudgetAccountId(namedMatch[1], accounts);
    return otherAccountId
      ? { otherAccountId, direction: "named" }
      : undefined;
  }
  return undefined;
}

function asCsvTransfer(
  row: ParsedCsvTransaction,
  fromAccountId: string,
  toAccountId: string,
): ParsedCsvTransaction {
  const next: ParsedCsvTransaction = {
    ...row,
    accountId: fromAccountId,
    transferAccountId: toAccountId,
    categoryId: null,
    type: "transfer",
  };
  next.importId = fileImportId(next);
  return next;
}

function applyPayeeTransfer(
  row: ParsedCsvTransaction,
  accounts: ParseBudgetCsvOptions["accounts"],
): ParsedCsvTransaction {
  if (row.type === "transfer") return row;
  const source = accounts.find((account) => account.id === row.accountId);
  if (!csvAccountOnBudget(source)) return row;

  const counterpart = parseTransferCounterpart(row.payee, accounts);
  if (!counterpart || counterpart.otherAccountId === row.accountId) return row;

  let fromAccountId = row.accountId;
  let toAccountId = counterpart.otherAccountId;
  if (counterpart.direction === "from") {
    fromAccountId = counterpart.otherAccountId;
    toAccountId = row.accountId;
  } else if (counterpart.direction === "named" && row.type === "inflow") {
    fromAccountId = counterpart.otherAccountId;
    toAccountId = row.accountId;
  }

  return asCsvTransfer(row, fromAccountId, toAccountId);
}

function transferPairKey(row: ParsedCsvTransaction): string {
  const other = row.transferAccountId ?? "";
  const [left, right] =
    row.accountId < other ? [row.accountId, other] : [other, row.accountId];
  return `${row.date}|${Math.round(Math.abs(row.amount) * 100)}|${left}|${right}`;
}

function pairOppositeAmountTransfers(
  rows: ParsedCsvTransaction[],
  accounts: ParseBudgetCsvOptions["accounts"],
): ParsedCsvTransaction[] {
  const leftover = rows.filter((row) => row.type !== "transfer");
  const transfers = rows.filter((row) => row.type === "transfer");
  const groups = new Map<string, ParsedCsvTransaction[]>();

  for (const row of leftover) {
    const key = `${row.date}|${Math.round(Math.abs(row.amount) * 100)}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const used = new Set<number>();
  const paired: ParsedCsvTransaction[] = [];

  for (const group of groups.values()) {
    if (group.length !== 2) continue;
    const first = group[0]!;
    const second = group[1]!;
    if (first.type === second.type) continue;
    if (first.accountId === second.accountId) continue;
    const firstAccount = accounts.find((account) => account.id === first.accountId);
    const secondAccount = accounts.find((account) => account.id === second.accountId);
    if (!csvAccountOnBudget(firstAccount) || !csvAccountOnBudget(secondAccount)) {
      continue;
    }
    const outflow = first.type === "outflow" ? first : second;
    const inflow = first.type === "inflow" ? first : second;
    used.add(first.sourceRow);
    used.add(second.sourceRow);
    paired.push(asCsvTransfer(outflow, outflow.accountId, inflow.accountId));
  }

  return [
    ...transfers,
    ...paired,
    ...leftover.filter((row) => !used.has(row.sourceRow)),
  ];
}

function collapseDuplicateTransfers(
  rows: ParsedCsvTransaction[],
): ParsedCsvTransaction[] {
  const transfers = rows.filter((row) => row.type === "transfer");
  const others = rows.filter((row) => row.type !== "transfer");
  const seen = new Set<string>();
  const kept: ParsedCsvTransaction[] = [];

  for (const row of [...transfers].sort((a, b) => a.sourceRow - b.sourceRow)) {
    const key = transferPairKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
  }

  return [...kept, ...others].sort((a, b) => a.sourceRow - b.sourceRow);
}

/** Reconstruct on-budget transfers from payee names or a unique opposite pair. */
export function reconstructCsvTransfers(
  rows: ParsedCsvTransaction[],
  accounts: ParseBudgetCsvOptions["accounts"],
): ParsedCsvTransaction[] {
  const named = rows.map((row) => applyPayeeTransfer(row, accounts));
  return collapseDuplicateTransfers(pairOppositeAmountTransfers(named, accounts));
}

interface ResolvedAmount {
  amount: number;
  type: "inflow" | "outflow";
}

function resolveAmount(
  row: string[],
  columns: ColumnMap,
  signMode: CsvSignMode,
): { ok: true; value: ResolvedAmount } | { ok: false; reason: CsvSkipReason; message: string } {
  const outflowRaw = cell(row, columns.outflow);
  const inflowRaw = cell(row, columns.inflow);
  const debitRaw = cell(row, columns.debit);
  const creditRaw = cell(row, columns.credit);
  const amountRaw = cell(row, columns.amount);
  const typeHint = classifyTypeHint(cell(row, columns.type), signMode);

  if (columns.outflow != null || columns.inflow != null) {
    const outflow = outflowRaw ? parseBudgetMoney(outflowRaw) : 0;
    const inflow = inflowRaw ? parseBudgetMoney(inflowRaw) : 0;
    if (outflow == null || inflow == null) {
      return {
        ok: false,
        reason: "invalid-amount",
        message: "Could not read Inflow/Outflow amounts.",
      };
    }
    const outAbs = Math.abs(outflow);
    const inAbs = Math.abs(inflow);
    if (outAbs > 0 && inAbs > 0) {
      return {
        ok: false,
        reason: "ambiguous-amount",
        message: "Row has both Inflow and Outflow values.",
      };
    }
    if (outAbs === 0 && inAbs === 0) {
      return { ok: false, reason: "zero-amount", message: "Amount is zero." };
    }
    return {
      ok: true,
      value: {
        amount: outAbs > 0 ? outAbs : inAbs,
        type: outAbs > 0 ? "outflow" : "inflow",
      },
    };
  }

  if (columns.debit != null || columns.credit != null) {
    const debit = debitRaw ? parseBudgetMoney(debitRaw) : 0;
    const credit = creditRaw ? parseBudgetMoney(creditRaw) : 0;
    if (debit == null || credit == null) {
      return {
        ok: false,
        reason: "invalid-amount",
        message: "Could not read Debit/Credit amounts.",
      };
    }
    const debitAbs = Math.abs(debit);
    const creditAbs = Math.abs(credit);
    if (debitAbs > 0 && creditAbs > 0) {
      return {
        ok: false,
        reason: "ambiguous-amount",
        message: "Row has both Debit and Credit values.",
      };
    }
    if (debitAbs === 0 && creditAbs === 0) {
      return { ok: false, reason: "zero-amount", message: "Amount is zero." };
    }
    return {
      ok: true,
      value: {
        amount: debitAbs > 0 ? debitAbs : creditAbs,
        type: debitAbs > 0 ? "outflow" : "inflow",
      },
    };
  }

  if (!amountRaw) {
    return { ok: false, reason: "missing-amount", message: "Amount is missing." };
  }

  const parsed = parseBudgetMoney(amountRaw);
  if (parsed == null) {
    return { ok: false, reason: "invalid-amount", message: "Amount is not a number." };
  }
  if (parsed === 0) {
    return { ok: false, reason: "zero-amount", message: "Amount is zero." };
  }

  if (typeHint) {
    return { ok: true, value: { amount: Math.abs(parsed), type: typeHint } };
  }

  if (signMode === "card") {
    return {
      ok: true,
      value: {
        amount: Math.abs(parsed),
        type: parsed < 0 ? "inflow" : "outflow",
      },
    };
  }

  return {
    ok: true,
    value: {
      amount: Math.abs(parsed),
      type: parsed < 0 ? "outflow" : "inflow",
    },
  };
}

interface ColumnMap {
  date?: number;
  payee?: number;
  payee2?: number;
  description?: number;
  amount?: number;
  debit?: number;
  credit?: number;
  outflow?: number;
  inflow?: number;
  memo?: number;
  category?: number;
  account?: number;
  cleared?: number;
  type?: number;
  cheque?: number;
  cad?: number;
  usd?: number;
}

function mapColumns(headers: string[], presetId?: string): ColumnMap {
  const columns: ColumnMap = {
    date: findColumn(headers, DATE_HEADERS),
    payee: findColumn(headers, PAYEE_HEADERS),
    payee2: findColumn(headers, ["description 2"]),
    description: findColumn(headers, ["description"]),
    amount: findColumn(headers, AMOUNT_HEADERS),
    debit: findColumn(headers, DEBIT_HEADERS),
    credit: findColumn(headers, CREDIT_HEADERS),
    outflow: findColumn(headers, OUTFLOW_HEADERS),
    inflow: findColumn(headers, INFLOW_HEADERS),
    memo: findColumn(headers, MEMO_HEADERS),
    category: findColumn(headers, CATEGORY_HEADERS),
    account: findColumn(headers, ACCOUNT_HEADERS),
    cleared: findColumn(headers, CLEARED_HEADERS),
    type: findColumn(headers, TYPE_HEADERS),
    cheque: findColumn(headers, ["cheque number", "check number", "cheque"]),
    cad: findColumn(headers, ["cad"]),
    usd: findColumn(headers, ["usd"]),
  };
  if (presetId === "tangerine") {
    columns.payee = findColumn(headers, ["name", "memo", "description"]);
    columns.type = findColumn(headers, ["transaction"]);
  }
  return columns;
}

function headerlessColumns(kind: Exclude<HeaderlessKind, null>): ColumnMap {
  if (kind === "debit-credit") {
    return { date: 0, payee: 1, debit: 2, credit: 3 };
  }
  return { date: 0, payee: 1, amount: 2 };
}

function rowLooksLikeHeaderless(row: string[]): HeaderlessKind {
  if (!parseBudgetDate(row[0] ?? "")) return null;
  if (row.length >= 4) return "debit-credit";
  if (row.length >= 3 && parseBudgetMoney(row[2] ?? "") != null) return "amount";
  return null;
}

function headersOf(row: string[]): string[] {
  return row.map(normalizeCsvHeader);
}

function hasAmountHeaders(headers: string[]): boolean {
  return (
    findColumn(headers, AMOUNT_HEADERS) != null ||
    findColumn(headers, DEBIT_HEADERS) != null ||
    findColumn(headers, CREDIT_HEADERS) != null ||
    findColumn(headers, OUTFLOW_HEADERS) != null ||
    findColumn(headers, INFLOW_HEADERS) != null ||
    findColumn(headers, ["cad", "usd"]) != null
  );
}

function findHeaderIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, 25);
  for (let index = 0; index < limit; index += 1) {
    const headers = headersOf(rows[index] ?? []);
    if (findColumn(headers, DATE_HEADERS) != null && hasAmountHeaders(headers)) {
      return index;
    }
  }
  return -1;
}

const PLAID_MATCH_DAY_WINDOW = 2;

export function payeesLikelyMatch(a: string, b: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const stop = new Set([
    "the",
    "pos",
    "debit",
    "credit",
    "purchase",
    "payment",
    "visa",
    "mastercard",
  ]);
  const tokens = (value: string) =>
    value.split(" ").filter((word) => word.length > 2 && !stop.has(word));
  const leftTokens = tokens(left);
  const rightTokens = new Set(tokens(right));
  if (leftTokens.length === 0 || rightTokens.size === 0) return false;
  return leftTokens.some((word) => rightTokens.has(word));
}

function findPlaidOverlap(
  row: Pick<ParsedCsvTransaction, "date" | "amount" | "accountId" | "payee">,
  existing: ParseBudgetCsvOptions["existingTransactions"],
  usedMatchIds: Set<string>,
): string | undefined {
  const cents = Math.round(Math.abs(row.amount) * 100);
  const candidates = existing.filter((tx) => {
    if (!tx.id || usedMatchIds.has(tx.id)) return false;
    if (!tx.importId?.startsWith("plaid:")) return false;
    if (tx.accountId !== row.accountId) return false;
    if (Math.round(Math.abs(tx.amount) * 100) !== cents) return false;
    return daysBetweenDateKeys(tx.date, row.date) <= PLAID_MATCH_DAY_WINDOW;
  });
  if (candidates.length === 0) return undefined;

  const similar = candidates.filter((tx) => payeesLikelyMatch(tx.payee, row.payee));
  let pool = similar;
  if (pool.length === 0) {
    const sameDay = candidates.filter((tx) => tx.date === row.date);
    if (sameDay.length === 1) pool = sameDay;
  }
  if (pool.length === 0) return undefined;

  pool.sort((a, b) => {
    const dateDelta =
      daysBetweenDateKeys(a.date, row.date) - daysBetweenDateKeys(b.date, row.date);
    if (dateDelta !== 0) return dateDelta;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
  return pool[0]?.id;
}

export function classifyImportCandidates(
  rows: ParsedCsvTransaction[],
  existing: ParseBudgetCsvOptions["existingTransactions"],
): {
  imported: ParsedCsvTransaction[];
  duplicates: ParsedCsvTransaction[];
  matched: CsvMatchedTransaction[];
} {
  const existingImportIds = new Set(
    existing
      .map((tx) => tx.importId)
      .filter((value): value is string => Boolean(value)),
  );
  const seenImportIds = new Set<string>();
  const seenKeys = new Set<string>();
  const usedMatchIds = new Set<string>();
  const imported: ParsedCsvTransaction[] = [];
  const duplicates: ParsedCsvTransaction[] = [];
  const matched: CsvMatchedTransaction[] = [];

  for (const parsed of rows) {
    if (existingImportIds.has(parsed.importId) || seenImportIds.has(parsed.importId)) {
      duplicates.push(parsed);
      continue;
    }

    const key = budgetImportDedupeKey(parsed);
    const fallbackHit =
      existing.some((tx) => {
        if (budgetImportDedupeKey(tx) !== key) return false;
        if (
          parsed.externalId &&
          tx.importId?.startsWith("ofx:") &&
          tx.importId !== parsed.importId
        ) {
          return false;
        }
        return true;
      }) ||
      (!parsed.externalId && seenKeys.has(key));

    if (fallbackHit) {
      seenImportIds.add(parsed.importId);
      duplicates.push(parsed);
      continue;
    }

    const plaidId = findPlaidOverlap(parsed, existing, usedMatchIds);
    if (plaidId) {
      usedMatchIds.add(plaidId);
      seenImportIds.add(parsed.importId);
      duplicates.push(parsed);
      continue;
    }

    const matchedId = findImportMatch(parsed, existing, usedMatchIds);
    if (matchedId) {
      usedMatchIds.add(matchedId);
      seenImportIds.add(parsed.importId);
      matched.push({ ...parsed, matchedTransactionId: matchedId });
      continue;
    }

    if (!parsed.externalId) seenKeys.add(key);
    seenImportIds.add(parsed.importId);
    imported.push(parsed);
  }

  return { imported, duplicates, matched };
}

function currencyMismatchMessage(fileCurrency: string, planCurrency: string): string {
  return `This file is in ${fileCurrency} and this budget is in ${planCurrency}.`;
}

export function parseBudgetCsv(
  csvText: string,
  options: ParseBudgetCsvOptions,
): CsvImportPreview {
  const empty: CsvImportPreview = {
    totalRows: 0,
    imported: [],
    duplicates: [],
    matched: [],
    skipped: [],
    inflowCount: 0,
    outflowCount: 0,
    transferCount: 0,
    inflowTotal: 0,
    outflowTotal: 0,
    hasAccountColumn: false,
    hasCategoryColumn: false,
    detectedColumns: [],
    notes: [],
    formatLabel: "",
  };

  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return { ...empty, error: "The file is empty." };
  }

  const headerIndex = findHeaderIndex(rows);
  let headerless: HeaderlessKind = null;
  let headers: string[] = [];
  let dataRows: string[][];
  if (headerIndex >= 0) {
    headers = headersOf(rows[headerIndex] ?? []);
    dataRows = rows.slice(headerIndex + 1);
  } else {
    headerless = rowLooksLikeHeaderless(rows[0] ?? []);
    if (!headerless) {
      return {
        ...empty,
        error:
          "Could not find Date plus Amount, Debit/Credit, or Inflow/Outflow columns.",
      };
    }
    dataRows = rows;
  }

  const preset = resolveCsvPreset(options.preset, headers, headerless);
  const columns = headerless
    ? headerlessColumns(headerless)
    : mapColumns(headers, preset.id);
  const detectedColumns = Object.entries(columns)
    .filter(([, index]) => index != null)
    .map(([name]) => name);

  const hasAmountShape =
    columns.amount != null ||
    columns.debit != null ||
    columns.credit != null ||
    columns.outflow != null ||
    columns.inflow != null ||
    columns.cad != null ||
    columns.usd != null;

  if (columns.date == null || !hasAmountShape) {
    return {
      ...empty,
      totalRows: dataRows.length,
      detectedColumns,
      presetId: preset.id,
      formatLabel: preset.label,
      formatNote: preset.note,
      error:
        "Could not find Date plus Amount, Debit/Credit, or Inflow/Outflow columns.",
    };
  }

  let amountColumns = columns;
  let foreignCurrency: BudgetCurrency | null = null;
  if (columns.cad != null || columns.usd != null) {
    const fileCurrency: BudgetCurrency | null =
      columns.cad != null && columns.usd == null
        ? "CAD"
        : columns.usd != null && columns.cad == null
          ? "USD"
          : null;
    if (
      options.currency &&
      fileCurrency &&
      fileCurrency !== options.currency
    ) {
      return {
        ...empty,
        totalRows: dataRows.length,
        detectedColumns,
        presetId: preset.id,
        formatLabel: preset.label,
        formatNote: preset.note,
        error: currencyMismatchMessage(fileCurrency, options.currency),
      };
    }
    const want = options.currency ?? fileCurrency ?? (columns.cad != null ? "CAD" : "USD");
    if (want === "CAD" && columns.cad != null) {
      amountColumns = { ...columns, amount: columns.cad };
      foreignCurrency = columns.usd != null ? "USD" : null;
    } else if (want === "USD" && columns.usd != null) {
      amountColumns = { ...columns, amount: columns.usd };
      foreignCurrency = columns.cad != null ? "CAD" : null;
    }
  }

  const notes = [
    preset.note,
    "Transfers between two on-budget accounts are reconstructed when the payee names the other account, or a unique same-date opposite pair is found. Splits stay flattened.",
    "Uncategorized outflows are left uncategorized unless Category exactly matches an existing category name.",
    "Exact duplicates (date + payee + amount + account) are skipped. Close-date matches stay on the existing row. A bank row already imported from a linked account is skipped when the amount, account, and date line up.",
  ];

  const candidates: ParsedCsvTransaction[] = [];
  const skipped: CsvSkippedRow[] = [];
  let sawTransferLike = false;

  dataRows.forEach((row, index) => {
    const rowNumber = headerless ? index + 1 : headerIndex + index + 2;
    if (!row.some((value) => value.trim() !== "")) {
      skipped.push({
        rowNumber,
        reason: "empty-row",
        message: "Empty row.",
      });
      return;
    }

    const dateRaw = cell(row, columns.date);
    if (!dateRaw) {
      skipped.push({
        rowNumber,
        reason: "missing-date",
        message: "Date is missing.",
      });
      return;
    }
    const date = parseBudgetDate(dateRaw, preset.dateOrder);
    if (!date) {
      skipped.push({
        rowNumber,
        reason: "invalid-date",
        message: `Could not parse date “${dateRaw}”.`,
      });
      return;
    }

    if (foreignCurrency && options.currency) {
      const foreignIndex = foreignCurrency === "USD" ? columns.usd : columns.cad;
      const localRaw = cell(row, amountColumns.amount);
      const foreignRaw = cell(row, foreignIndex);
      if (!localRaw && foreignRaw) {
        skipped.push({
          rowNumber,
          reason: "currency-mismatch",
          message: `This amount is in ${foreignCurrency} and this budget is in ${options.currency}.`,
        });
        return;
      }
    }

    const amountResult = resolveAmount(row, amountColumns, preset.signMode);
    if (!amountResult.ok) {
      skipped.push({
        rowNumber,
        reason: amountResult.reason,
        message: amountResult.message,
      });
      return;
    }

    const payeeExtra = cell(row, columns.payee2);
    const payeeBase =
      cell(row, columns.payee) ||
      cell(row, columns.description) ||
      cell(row, columns.memo);
    const payee = [payeeBase, payeeExtra && payeeExtra !== payeeBase ? payeeExtra : ""]
      .filter(Boolean)
      .join(" ");
    if (!payee) {
      skipped.push({
        rowNumber,
        reason: "missing-payee",
        message: "Payee / Description is missing.",
      });
      return;
    }

    if (looksLikeTransferPayee(payee)) {
      sawTransferLike = true;
    }

    let accountId: string | undefined;
    const accountName = cell(row, columns.account);
    if (columns.account != null && accountName) {
      accountId = matchAccountId(accountName, options.accounts);
      if (!accountId) {
        skipped.push({
          rowNumber,
          reason: "unknown-account",
          message: `No account named “${accountName}”.`,
        });
        return;
      }
    } else if (options.fallbackAccountId) {
      accountId = options.fallbackAccountId;
    } else {
      skipped.push({
        rowNumber,
        reason: "missing-account",
        message: "Choose an account to import into.",
      });
      return;
    }

    const cheque = cell(row, columns.cheque);
    const memoText = cell(row, columns.memo);
    const memo =
      [memoText, cheque ? `Cheque ${cheque}` : ""].filter(Boolean).join(" · ") ||
      undefined;
    const categoryId =
      columns.category != null
        ? matchCategoryId(cell(row, columns.category), options.categories)
        : null;

    const parsed: ParsedCsvTransaction = {
      date,
      payee,
      accountId,
      categoryId,
      amount: amountResult.value.amount,
      type: amountResult.value.type,
      cleared: parseCleared(cell(row, columns.cleared)),
      memo,
      sourceRow: rowNumber,
      importId: "",
    };
    parsed.importId = fileImportId(parsed);
    candidates.push(parsed);
  });

  const reconstructed = reconstructCsvTransfers(candidates, options.accounts);
  const reconstructedCount = reconstructed.filter((row) => row.type === "transfer").length;
  const leftoverTransferLike = reconstructed.filter(
    (row) => row.type !== "transfer" && looksLikeTransferPayee(row.payee),
  ).length;

  const { imported, duplicates, matched } = classifyImportCandidates(
    reconstructed,
    options.existingTransactions,
  );

  if (reconstructedCount > 0) {
    notes.unshift(
      `Reconstructed ${reconstructedCount} transfer${reconstructedCount === 1 ? "" : "s"} between on-budget accounts.`,
    );
  }
  if (sawTransferLike && leftoverTransferLike > 0) {
    notes.unshift(
      "Some transfer-like payees did not name a known on-budget account, so they stayed inflow/outflow.",
    );
  }

  return {
    totalRows: dataRows.length,
    imported,
    duplicates,
    matched,
    skipped,
    inflowCount: imported.filter((tx) => tx.type === "inflow").length,
    outflowCount: imported.filter((tx) => tx.type === "outflow").length,
    transferCount: imported.filter((tx) => tx.type === "transfer").length,
    inflowTotal: imported
      .filter((tx) => tx.type === "inflow")
      .reduce((sum, tx) => sum + tx.amount, 0),
    outflowTotal: imported
      .filter((tx) => tx.type === "outflow")
      .reduce((sum, tx) => sum + tx.amount, 0),
    hasAccountColumn: columns.account != null,
    hasCategoryColumn: columns.category != null,
    detectedColumns,
    notes,
    presetId: preset.id,
    formatLabel: preset.label,
    formatNote: preset.note,
  };
}

export function parsedCsvToTransactionInput(row: ParsedCsvTransaction) {
  return {
    date: row.date,
    payee: row.payee,
    accountId: row.accountId,
    categoryId: row.type === "inflow" || row.type === "transfer" ? null : row.categoryId,
    amount: row.amount,
    type: row.type,
    memo: row.memo,
    cleared: clearedStateFromCsvFlag(row.cleared),
    approved: false,
    importId: row.importId || budgetImportId(row),
    transferAccountId: row.type === "transfer" ? row.transferAccountId : undefined,
  };
}
