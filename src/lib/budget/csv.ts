import { clearedStateFromCsvFlag } from "@/lib/budget/cleared";
import type { BudgetAccount, BudgetCategory, BudgetTransaction } from "@/types/budget";

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

export function daysBetweenDateKeys(a: string, b: string): number {
  const start = Date.parse(`${a}T12:00:00Z`);
  const end = Date.parse(`${b}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((end - start) / 86_400_000));
}

export function findImportMatch(
  row: Pick<ParsedCsvTransaction, "date" | "amount" | "accountId" | "type">,
  existing: ParseBudgetCsvOptions["existingTransactions"],
  usedMatchIds: Set<string>,
): string | undefined {
  const cents = Math.round(Math.abs(row.amount) * 100);
  const candidates = existing.filter((tx) => {
    if (!tx.id || usedMatchIds.has(tx.id)) return false;
    if (tx.importId) return false;
    if (tx.accountId !== row.accountId) return false;
    if (Math.round(Math.abs(tx.amount) * 100) !== cents) return false;
    if (tx.type && tx.type !== row.type) return false;
    return daysBetweenDateKeys(tx.date, row.date) <= IMPORT_MATCH_DAY_WINDOW;
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
  | "missing-account";

export interface ParsedCsvTransaction {
  date: string;
  payee: string;
  accountId: string;
  categoryId: string | null;
  amount: number;
  type: "inflow" | "outflow";
  cleared: boolean;
  memo?: string;
  sourceRow: number;
  importId: string;
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
  inflowTotal: number;
  outflowTotal: number;
  hasAccountColumn: boolean;
  hasCategoryColumn: boolean;
  detectedColumns: string[];
  notes: string[];
  error?: string;
}

export interface ParseBudgetCsvOptions {
  accounts: Pick<BudgetAccount, "id" | "name">[];
  categories: Pick<BudgetCategory, "id" | "name">[];
  existingTransactions: Array<
    Pick<BudgetTransaction, "date" | "payee" | "amount" | "accountId"> &
      Partial<Pick<BudgetTransaction, "id" | "type" | "importId">>
  >;
  fallbackAccountId?: string;
}

const DATE_HEADERS = [
  "date",
  "transaction date",
  "posted date",
  "posting date",
  "trans date",
];
const PAYEE_HEADERS = ["payee", "description", "name", "merchant", "narrative"];
const AMOUNT_HEADERS = ["amount", "transaction amount", "amt"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals"];
const CREDIT_HEADERS = ["credit", "deposit", "deposits"];
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

export function parseBudgetDate(raw: string): string | null {
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
    return ymd(expandYear(Number(us[3])), Number(us[1]), Number(us[2]));
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

function classifyTypeHint(raw: string): "inflow" | "outflow" | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
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

interface ResolvedAmount {
  amount: number;
  type: "inflow" | "outflow";
}

function resolveAmount(
  row: string[],
  columns: ColumnMap,
): { ok: true; value: ResolvedAmount } | { ok: false; reason: CsvSkipReason; message: string } {
  const outflowRaw = cell(row, columns.outflow);
  const inflowRaw = cell(row, columns.inflow);
  const debitRaw = cell(row, columns.debit);
  const creditRaw = cell(row, columns.credit);
  const amountRaw = cell(row, columns.amount);
  const typeHint = classifyTypeHint(cell(row, columns.type));

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
}

function mapColumns(headers: string[]): ColumnMap {
  return {
    date: findColumn(headers, DATE_HEADERS),
    payee: findColumn(headers, PAYEE_HEADERS),
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
  };
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
    inflowTotal: 0,
    outflowTotal: 0,
    hasAccountColumn: false,
    hasCategoryColumn: false,
    detectedColumns: [],
    notes: [],
  };

  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return { ...empty, error: "The file is empty." };
  }

  const headers = rows[0].map(normalizeCsvHeader);
  const columns = mapColumns(headers);
  const dataRows = rows.slice(1);
  const detectedColumns = Object.entries(columns)
    .filter(([, index]) => index != null)
    .map(([name]) => name);

  const hasAmountShape =
    columns.amount != null ||
    columns.debit != null ||
    columns.credit != null ||
    columns.outflow != null ||
    columns.inflow != null;

  if (columns.date == null || !hasAmountShape) {
    return {
      ...empty,
      totalRows: dataRows.length,
      detectedColumns,
      error:
        "Could not find Date plus Amount, Debit/Credit, or Inflow/Outflow columns.",
    };
  }

  const notes = [
    "Transfers and splits are imported as plain inflows or outflows so Ready to Assign math stays intact. Categorize or convert them after import if needed.",
    "Uncategorized outflows are left uncategorized unless Category exactly matches an existing category name.",
    "Exact duplicates (date + payee + amount + account) are skipped. Close-date matches stay on the existing row.",
  ];

  const existingKeys = new Set(
    options.existingTransactions.map((tx) => budgetImportDedupeKey(tx)),
  );
  const existingImportIds = new Set(
    options.existingTransactions
      .map((tx) => tx.importId)
      .filter((value): value is string => Boolean(value)),
  );
  const seenKeys = new Set<string>();
  const usedMatchIds = new Set<string>();
  const imported: ParsedCsvTransaction[] = [];
  const duplicates: ParsedCsvTransaction[] = [];
  const matched: CsvMatchedTransaction[] = [];
  const skipped: CsvSkippedRow[] = [];
  let sawTransferLike = false;

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
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
    const date = parseBudgetDate(dateRaw);
    if (!date) {
      skipped.push({
        rowNumber,
        reason: "invalid-date",
        message: `Could not parse date “${dateRaw}”.`,
      });
      return;
    }

    const amountResult = resolveAmount(row, columns);
    if (!amountResult.ok) {
      skipped.push({
        rowNumber,
        reason: amountResult.reason,
        message: amountResult.message,
      });
      return;
    }

    const payee =
      cell(row, columns.payee) ||
      cell(row, columns.description) ||
      cell(row, columns.memo);
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

    const memo = cell(row, columns.memo) || undefined;
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
    parsed.importId = budgetImportId(parsed);

    if (existingImportIds.has(parsed.importId)) {
      duplicates.push(parsed);
      return;
    }

    const key = budgetImportDedupeKey(parsed);
    if (existingKeys.has(key) || seenKeys.has(key)) {
      duplicates.push(parsed);
      return;
    }

    const matchedId = findImportMatch(parsed, options.existingTransactions, usedMatchIds);
    if (matchedId) {
      usedMatchIds.add(matchedId);
      matched.push({ ...parsed, matchedTransactionId: matchedId });
      return;
    }

    seenKeys.add(key);
    imported.push(parsed);
  });

  if (sawTransferLike) {
    notes.unshift(
      "Some payees look like transfers. They are still stored as inflow/outflow, not type: transfer.",
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
  };
}

export function parsedCsvToTransactionInput(row: ParsedCsvTransaction) {
  return {
    date: row.date,
    payee: row.payee,
    accountId: row.accountId,
    categoryId: row.type === "inflow" ? null : row.categoryId,
    amount: row.amount,
    type: row.type,
    memo: row.memo,
    cleared: clearedStateFromCsvFlag(row.cleared),
    approved: false,
    importId: row.importId || budgetImportId(row),
  };
}
