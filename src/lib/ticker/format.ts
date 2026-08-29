import type { TickerField } from "@/lib/ticker/types";

export const TICKER_UNKNOWN = "Unknown";

export function formatTickerField(field: TickerField): string {
  if (field.value == null || !Number.isFinite(field.value)) {
    return TICKER_UNKNOWN;
  }
  const value = field.value;
  switch (field.kind) {
    case "money":
      return formatCompact(value);
    case "shares":
      return formatCompactCount(value);
    case "percent":
      return formatPercentValue(value);
    case "multiple":
    case "ratio":
      return formatRatio(value);
    case "count":
      return Number.isInteger(value)
        ? value.toLocaleString("en-US")
        : value.toFixed(1);
    default:
      return TICKER_UNKNOWN;
  }
}

export function formatTickerPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return TICKER_UNKNOWN;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

export function formatTickerCacheAge(fetchedAt: string | null | undefined): string {
  if (!fetchedAt) return TICKER_UNKNOWN;
  const then = Date.parse(fetchedAt);
  if (!Number.isFinite(then)) return TICKER_UNKNOWN;
  const ms = Date.now() - then;
  if (!Number.isFinite(ms) || ms < 0) return TICKER_UNKNOWN;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatTickerMarketCap(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return TICKER_UNKNOWN;
  return formatCompact(value);
}

function formatPercentValue(value: number): string {
  const pct = Math.abs(value) <= 1.5 ? value * 100 : value;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatRatio(value: number): string {
  const digits = Math.abs(value) >= 100 ? 1 : 2;
  return `${value.toFixed(digits)}×`;
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCount(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
