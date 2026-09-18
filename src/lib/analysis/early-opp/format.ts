import { formatTickerField, formatTickerMarketCap, formatTickerPrice } from "@/lib/ticker/format";
import type { EarlyOppNumber, EarlyOppNumberKind, EarlyOppStatus } from "@/lib/analysis/early-opp/types";

export const EARLY_OPP_DISCLAIMER =
  "Educational decision aid — not personalized investment advice. You can lose money. Missing Financial Modeling Prep figures stay unknown; they are not guessed.";

export function statusLabel(status: EarlyOppStatus): string {
  if (status === "pass") return "Pass";
  if (status === "soft") return "Soft";
  if (status === "fail") return "Fail";
  return "Unknown";
}

export function countStatuses(
  statuses: EarlyOppStatus[],
): { pass: number; soft: number; fail: number; unknown: number } {
  return statuses.reduce(
    (acc, status) => {
      acc[status] += 1;
      return acc;
    },
    { pass: 0, soft: 0, fail: 0, unknown: 0 },
  );
}

export function fmpNumber(
  label: string,
  value: number | null,
  kind: EarlyOppNumberKind,
): EarlyOppNumber | null {
  if (kind === "text") return null;
  if (value == null || !Number.isFinite(value)) return null;
  if (kind === "money") {
    return {
      label,
      display: formatTickerField({ label, value, kind: "money" }),
      value,
      kind,
      source: "fmp",
    };
  }
  if (kind === "percent") {
    return {
      label,
      display: formatTickerField({ label, value, kind: "percent" }),
      value,
      kind,
      source: "fmp",
    };
  }
  if (kind === "multiple" || kind === "ratio") {
    return {
      label,
      display: formatTickerField({
        label,
        value,
        kind: kind === "multiple" ? "multiple" : "ratio",
      }),
      value,
      kind,
      source: "fmp",
    };
  }
  return {
    label,
    display: formatTickerField({ label, value, kind: "count" }),
    value,
    kind,
    source: "fmp",
  };
}

export function fmpPrice(label: string, value: number | null): EarlyOppNumber | null {
  if (value == null || !Number.isFinite(value)) return null;
  return {
    label,
    display: formatTickerPrice(value),
    value,
    kind: "money",
    source: "fmp",
  };
}

export function fmpMarketCap(label: string, value: number | null): EarlyOppNumber | null {
  if (value == null || !Number.isFinite(value)) return null;
  return {
    label,
    display: formatTickerMarketCap(value),
    value,
    kind: "money",
    source: "fmp",
  };
}

export function compactNumbers(
  rows: Array<EarlyOppNumber | null | undefined>,
): EarlyOppNumber[] {
  return rows.filter((row): row is EarlyOppNumber => Boolean(row));
}
