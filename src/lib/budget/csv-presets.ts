/**
 * Column maps for Canadian bank and card CSV downloads.
 * Notes distinguish published layouts from mappings inferred when a bank
 * does not publish its export spec.
 */

export const CSV_PRESET_IDS = [
  "auto",
  "generic",
  "rbc",
  "td",
  "scotiabank",
  "bmo",
  "cibc",
  "tangerine",
  "eq-bank",
  "simplii",
  "credit-card",
] as const;

export type CsvPresetId = (typeof CSV_PRESET_IDS)[number];

export type CsvDateOrder = "mdy" | "dmy";

/** Bank: negative amount leaves the account. Card: positive amount is a purchase. */
export type CsvSignMode = "bank" | "card";

export interface CsvPreset {
  id: Exclude<CsvPresetId, "auto">;
  label: string;
  /** False when the column map is inferred rather than taken from a published layout. */
  documented: boolean;
  note: string;
  dateOrder: CsvDateOrder;
  signMode: CsvSignMode;
}

export const CSV_PRESETS: Record<Exclude<CsvPresetId, "auto">, CsvPreset> = {
  generic: {
    id: "generic",
    label: "Generic CSV",
    documented: true,
    note: "Matched Date plus Amount, Debit/Credit, or Inflow/Outflow from the header row. Slash dates are month/day/year.",
    dateOrder: "mdy",
    signMode: "bank",
  },
  rbc: {
    id: "rbc",
    label: "RBC",
    documented: true,
    note: "RBC activity CSV uses Account Type, Account Number, Transaction Date, Cheque Number, Description, CAD, and USD. Description 1 and Description 2 are joined when those columns are present. Dates are month/day/year. A negative CAD$ amount leaves the account. A USD-only row is skipped on a CAD budget. Card PDF statements use the opposite sign; this follows the activity download.",
    dateOrder: "mdy",
    signMode: "bank",
  },
  td: {
    id: "td",
    label: "TD",
    documented: true,
    note: "TD CSV uses Date, Description, Withdrawals, and Deposits. Dates are month/day/year. Withdrawals leave the account.",
    dateOrder: "mdy",
    signMode: "bank",
  },
  scotiabank: {
    id: "scotiabank",
    label: "Scotiabank",
    documented: false,
    note: "Scotiabank CSV is described publicly as Date, Description, Withdrawal, and Deposit. Those guides do not publish one date mask, so slash dates are read day/month/year. Year-first dates are read as written.",
    dateOrder: "dmy",
    signMode: "bank",
  },
  bmo: {
    id: "bmo",
    label: "BMO",
    documented: true,
    note: "BMO CSV uses First Bank Card or Account Number, Transaction Type, Date Posted, Transaction Amount, and Description. Debit is money out and Credit is money in. If the type is missing, a negative amount is money out. Card files with Posting Date and a single Amount use the credit-card preset instead.",
    dateOrder: "mdy",
    signMode: "bank",
  },
  cibc: {
    id: "cibc",
    label: "CIBC",
    documented: true,
    note: "CIBC CSV uses Transaction Date, Description, Withdrawals, and Deposits. Dates are year-month-day. A headerless file with those same columns is accepted.",
    dateOrder: "mdy",
    signMode: "bank",
  },
  tangerine: {
    id: "tangerine",
    label: "Tangerine",
    documented: false,
    note: "Tangerine’s help page confirms a CSV download and does not list columns. This preset reads Date, Transaction (a type code, not the payee), Name, Memo, and Amount. Dates are month/day/year, including values such as 12-10-2026. A negative amount leaves the account.",
    dateOrder: "mdy",
    signMode: "bank",
  },
  "eq-bank": {
    id: "eq-bank",
    label: "EQ Bank",
    documented: false,
    note: "EQ Bank’s help pages confirm a CSV download and do not publish the columns. This preset reads Date, Description, and a signed Amount (negative leaves the account), or separate Withdrawal and Deposit columns. Year-first dates are read as written. Slash dates are month/day/year.",
    dateOrder: "mdy",
    signMode: "bank",
  },
  simplii: {
    id: "simplii",
    label: "Simplii",
    documented: false,
    note: "Simplii publishes download steps and not the column list. Simplii uses CIBC’s platform, so this preset follows that layout and also accepts Funds Out and Funds In. Year-first dates are read as written. Slash dates are month/day/year.",
    dateOrder: "mdy",
    signMode: "bank",
  },
  "credit-card": {
    id: "credit-card",
    label: "Credit card",
    documented: false,
    note: "Common card download, not one issuer’s published spec: Transaction Date, Posting Date, Description, and Amount. A positive amount is a purchase. A negative amount is a payment or refund. Transaction Date is the register date.",
    dateOrder: "mdy",
    signMode: "card",
  },
};

export function isCsvPresetId(value: string): value is CsvPresetId {
  return (CSV_PRESET_IDS as readonly string[]).includes(value);
}

function has(headers: string[], name: string): boolean {
  return headers.includes(name);
}

function hasAny(headers: string[], names: string[]): boolean {
  return names.some((name) => headers.includes(name));
}

export type HeaderlessKind = "debit-credit" | "amount" | null;

/**
 * Pick a preset from the header row. Generic wins when no bank signature is present,
 * so an ordinary Date/Amount file is not claimed as a bank export.
 */
export function detectCsvPreset(
  headers: string[],
  headerless: HeaderlessKind,
): CsvPreset {
  if (headerless === "debit-credit") return CSV_PRESETS.cibc;
  if (
    hasAny(headers, ["cad", "usd"]) &&
    hasAny(headers, [
      "description 1",
      "cheque number",
      "check number",
      "account type",
      "transaction date",
    ])
  ) {
    return CSV_PRESETS.rbc;
  }
  if (has(headers, "funds out") || has(headers, "funds in")) {
    return CSV_PRESETS.simplii;
  }
  if (
    has(headers, "date") &&
    has(headers, "transaction") &&
    has(headers, "name") &&
    !has(headers, "withdrawals") &&
    !has(headers, "debit")
  ) {
    return CSV_PRESETS.tangerine;
  }
  if (
    (has(headers, "posting date") || has(headers, "card number")) &&
    hasAny(headers, ["amount", "transaction amount"]) &&
    !has(headers, "transaction type") &&
    !has(headers, "withdrawals") &&
    !has(headers, "debit")
  ) {
    return CSV_PRESETS["credit-card"];
  }
  if (has(headers, "date posted") && has(headers, "transaction amount")) {
    return CSV_PRESETS.bmo;
  }
  if (
    has(headers, "transaction date") &&
    has(headers, "withdrawals") &&
    has(headers, "deposits")
  ) {
    return CSV_PRESETS.cibc;
  }
  if (has(headers, "withdrawals") && has(headers, "deposits")) {
    return CSV_PRESETS.td;
  }
  if (
    has(headers, "withdrawal") &&
    has(headers, "deposit") &&
    !has(headers, "withdrawals") &&
    !has(headers, "deposits")
  ) {
    return CSV_PRESETS.scotiabank;
  }
  return CSV_PRESETS.generic;
}

export function resolveCsvPreset(
  requested: CsvPresetId | undefined,
  headers: string[],
  headerless: HeaderlessKind,
): CsvPreset {
  if (requested && requested !== "auto") return CSV_PRESETS[requested];
  return detectCsvPreset(headers, headerless);
}
