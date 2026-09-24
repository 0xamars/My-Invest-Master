import {
  classifyImportCandidates,
  fileImportId,
  parseBudgetDate,
  parseBudgetMoney,
  reconstructCsvTransfers,
  type CsvImportPreview,
  type CsvSkippedRow,
  type ParseBudgetCsvOptions,
  type ParsedCsvTransaction,
} from "@/lib/budget/csv";
import type { BudgetCurrency } from "@/types/budget";

export interface ParseBudgetOfxOptions extends ParseBudgetCsvOptions {
  fileName?: string;
}

const REJECTED_EXTENSIONS = new Set([
  "pdf",
  "xlsx",
  "xls",
  "qif",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "zip",
  "ofc",
]);

export function detectBudgetImportKind(
  fileName: string,
  text: string,
): { kind: "csv" | "ofx" } | { kind: "rejected"; error: string } {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { kind: "rejected", error: "The file is empty." };
  if (trimmed.includes("\u0000")) {
    return { kind: "rejected", error: "Choose a .csv, .ofx, or .qfx file." };
  }

  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const head = trimmed.slice(0, 800).toUpperCase();
  const looksOfx = head.includes("<OFX") || head.includes("OFXHEADER:");

  if (REJECTED_EXTENSIONS.has(ext)) {
    return { kind: "rejected", error: "Choose a .csv, .ofx, or .qfx file." };
  }
  if (looksOfx) return { kind: "ofx" };
  if (ext === "ofx" || ext === "qfx" || ext === "qbo") {
    return {
      kind: "rejected",
      error: "This file does not look like an OFX or QFX statement.",
    };
  }
  if (ext === "csv" || ext === "txt" || ext === "") return { kind: "csv" };
  return { kind: "rejected", error: "Choose a .csv, .ofx, or .qfx file." };
}

export function describeOfxFormat(fileName: string, text: string): string {
  const name = fileName.toLowerCase();
  const head = text.slice(0, 2000).toUpperCase();
  if (name.endsWith(".qfx") || head.includes("INTU.BID")) return "QFX";
  if (
    head.includes("<?XML") ||
    head.includes('OFXHEADER="200"') ||
    /VERSION="2\d\d"/.test(head)
  ) {
    return "OFX 2";
  }
  return "OFX 1";
}

function extractBlocks(text: string, tag: string): string[] {
  const open = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = open.exec(text))) {
    const start = match.index + match[0].length;
    const rest = text.slice(start);
    const close = new RegExp(`</${tag}>`, "i").exec(rest);
    const nextOpen = new RegExp(`<${tag}\\b`, "i").exec(rest);
    let end = rest.length;
    if (close && (!nextOpen || close.index < nextOpen.index)) {
      end = close.index;
    } else if (nextOpen) {
      end = nextOpen.index;
    }
    blocks.push(rest.slice(0, end));
  }
  return blocks;
}

function tagValues(block: string): Map<string, string> {
  const values = new Map<string, string>();
  const pattern = /<([A-Za-z0-9.]+)>([^<]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(block))) {
    const key = match[1].toUpperCase();
    const value = match[2].replace(/\s+/g, " ").trim();
    if (!value || values.has(key)) continue;
    values.set(key, value);
  }
  return values;
}

function parseOfxDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const compact = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!compact) return parseBudgetDate(raw);
  return parseBudgetDate(`${compact[1]}-${compact[2]}-${compact[3]}`);
}

interface OfxStatement {
  currency?: string;
  accountId?: string;
  blocks: string[];
}

function readStatements(text: string): OfxStatement[] {
  const chunks = [
    ...extractBlocks(text, "STMTRS"),
    ...extractBlocks(text, "CCSTMTRS"),
  ];
  if (chunks.length === 0) {
    const values = tagValues(text);
    return [
      {
        currency: values.get("CURDEF"),
        accountId: values.get("ACCTID"),
        blocks: extractBlocks(text, "STMTTRN"),
      },
    ];
  }
  return chunks.map((chunk) => {
    const values = tagValues(chunk);
    return {
      currency: values.get("CURDEF"),
      accountId: values.get("ACCTID"),
      blocks: extractBlocks(chunk, "STMTTRN"),
    };
  });
}

function emptyPreview(formatLabel: string): CsvImportPreview {
  return {
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
    detectedColumns: ["date", "payee", "amount", "fitid"],
    notes: [],
    formatLabel,
  };
}

/**
 * OFX 1.x SGML, OFX 2.x XML, and QFX (SGML plus Intuit tags).
 * TRNAMT sign follows the OFX spec: negative leaves the account, for bank and card.
 */
export function parseBudgetOfx(
  text: string,
  options: ParseBudgetOfxOptions,
): CsvImportPreview {
  const source = text.replace(/^\uFEFF/, "");
  const formatLabel = describeOfxFormat(options.fileName ?? "", source);
  const empty = emptyPreview(formatLabel);

  if (!source.trim()) {
    return { ...empty, error: "The file is empty." };
  }
  if (!/<OFX\b/i.test(source) && !/OFXHEADER:/i.test(source)) {
    return {
      ...empty,
      error: "This file does not look like an OFX or QFX statement.",
    };
  }

  const statements = readStatements(source);
  const currencies = [
    ...new Set(
      statements
        .map((statement) => statement.currency?.toUpperCase())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  if (currencies.length > 1) {
    return {
      ...empty,
      error: `This file mixes ${currencies.join(" and ")}.`,
    };
  }

  const fileCurrency = currencies[0];
  if (options.currency && fileCurrency && fileCurrency !== options.currency) {
    return {
      ...empty,
      error: `This file is in ${fileCurrency} and this budget is in ${options.currency}.`,
    };
  }

  if (!options.fallbackAccountId) {
    return { ...empty, error: "Choose an account to import into." };
  }

  const accountIds = [
    ...new Set(
      statements
        .map((statement) => statement.accountId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const notes = [
    `${formatLabel} amounts follow the file sign: negative leaves the account. FITID keeps a re-import from duplicating, including rows already brought in from a linked account when the amount and date match.`,
    "Imported rows stay uncleared so they show up in reconcile, and payee rules run when you confirm.",
  ];
  if (!fileCurrency) {
    notes.push("This file does not name a currency.");
  }
  if (accountIds.length > 1) {
    notes.push(
      "This file lists more than one account. Every transaction imports into the account you selected.",
    );
  }

  const skipped: CsvSkippedRow[] = [];
  const candidates: ParsedCsvTransaction[] = [];
  let sourceRow = 0;

  for (const statement of statements) {
    for (const block of statement.blocks) {
      sourceRow += 1;
      const values = tagValues(block);
      const dateRaw = values.get("DTPOSTED") || values.get("DTUSER") || "";
      if (!dateRaw) {
        skipped.push({
          rowNumber: sourceRow,
          reason: "missing-date",
          message: "Date is missing.",
        });
        continue;
      }
      const date = parseOfxDate(dateRaw);
      if (!date) {
        skipped.push({
          rowNumber: sourceRow,
          reason: "invalid-date",
          message: `Could not parse date “${dateRaw.slice(0, 32)}”.`,
        });
        continue;
      }

      const txnCurrency = values.get("CURSYM")?.toUpperCase();
      if (
        options.currency &&
        txnCurrency &&
        txnCurrency !== options.currency
      ) {
        skipped.push({
          rowNumber: sourceRow,
          reason: "currency-mismatch",
          message: `This amount is in ${txnCurrency} and this budget is in ${options.currency}.`,
        });
        continue;
      }

      const amountRaw = values.get("TRNAMT") ?? "";
      if (!amountRaw) {
        skipped.push({
          rowNumber: sourceRow,
          reason: "missing-amount",
          message: "Amount is missing.",
        });
        continue;
      }
      const parsedAmount = parseBudgetMoney(amountRaw);
      if (parsedAmount == null) {
        skipped.push({
          rowNumber: sourceRow,
          reason: "invalid-amount",
          message: "Amount is not a number.",
        });
        continue;
      }
      if (parsedAmount === 0) {
        skipped.push({
          rowNumber: sourceRow,
          reason: "zero-amount",
          message: "Amount is zero.",
        });
        continue;
      }

      const name = values.get("NAME") || values.get("PAYEE") || "";
      const memoText = values.get("MEMO") || "";
      const payee = name || memoText;
      if (!payee) {
        skipped.push({
          rowNumber: sourceRow,
          reason: "missing-payee",
          message: "Payee is missing.",
        });
        continue;
      }
      const cheque = values.get("CHECKNUM");
      const memo =
        [memoText && memoText !== payee ? memoText : "", cheque ? `Cheque ${cheque}` : ""]
          .filter(Boolean)
          .join(" · ") || undefined;
      const fitId = values.get("FITID")?.trim();

      const row: ParsedCsvTransaction = {
        date,
        payee,
        accountId: options.fallbackAccountId,
        categoryId: null,
        amount: Math.abs(parsedAmount),
        type: parsedAmount < 0 ? "outflow" : "inflow",
        cleared: false,
        memo,
        sourceRow,
        importId: "",
        externalId: fitId || undefined,
      };
      row.importId = fileImportId(row);
      candidates.push(row);
    }
  }

  if (candidates.length === 0 && skipped.length === 0) {
    return {
      ...empty,
      notes,
      error: "No transactions were found in this file.",
    };
  }

  const reconstructed = reconstructCsvTransfers(candidates, options.accounts);
  const { imported, duplicates, matched } = classifyImportCandidates(
    reconstructed,
    options.existingTransactions,
  );

  return {
    totalRows: sourceRow,
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
    hasAccountColumn: false,
    hasCategoryColumn: false,
    detectedColumns: empty.detectedColumns,
    notes,
    formatLabel,
    formatNote: notes.join(" "),
  };
}
