export function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  if (value === 1) return true;
  if (value === 0) return false;
  return null;
}

export function pick(
  row: Record<string, unknown> | null | undefined,
  ...keys: string[]
): number | null {
  if (!row) return null;
  for (const key of keys) {
    const direct = num(row[key]);
    if (direct != null) return direct;
    if (key.endsWith("TTM")) {
      const alt = num(row[key.slice(0, -3)]);
      if (alt != null) return alt;
    } else {
      const withTtm = num(row[`${key}TTM`]);
      if (withTtm != null) return withTtm;
    }
  }
  return null;
}

export function ratio(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (numerator == null || denominator == null || denominator === 0) {
    return null;
  }
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

export function yoyChange(
  latest: number | null,
  prior: number | null,
): number | null {
  if (latest == null || prior == null || prior === 0) return null;
  const value = (latest - prior) / Math.abs(prior);
  return Number.isFinite(value) ? value : null;
}

export function field(
  label: string,
  value: number | null,
  kind: "money" | "ratio" | "percent" | "shares" | "multiple" | "count",
) {
  return { label, value, kind };
}

export function firstRow(
  rows: Record<string, unknown>[] | null | undefined,
): Record<string, unknown> | null {
  return Array.isArray(rows) && rows[0] && typeof rows[0] === "object"
    ? rows[0]
    : null;
}

export function fiscalYearLabel(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const year = str(row.calendarYear);
  if (year) return year;
  const date = str(row.date) ?? str(row.fiscalDateEnding);
  if (date && /^\d{4}/.test(date)) return date.slice(0, 4);
  return null;
}
