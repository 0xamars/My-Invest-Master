/** Dataset TTLs and warehouse identifiers for the FMP Analysis Package. */

export type WarehouseDataset =
  | "profile"
  | "quote"
  | "income_annual"
  | "income_quarter"
  | "income_ttm"
  | "balance_annual"
  | "balance_quarter"
  | "balance_ttm"
  | "cashflow_annual"
  | "cashflow_quarter"
  | "cashflow_ttm"
  | "ratios_ttm"
  | "ratios_annual"
  | "key_metrics_ttm"
  | "key_metrics_annual"
  | "financial_scores"
  | "enterprise_values"
  | "owner_earnings"
  | "growth"
  | "estimates"
  | "street_consensus"
  | "peers"
  | "dcf"
  | "price_daily"
  | "price_hourly"
  | "investor_events";

/** TTL in milliseconds for non-empty cached rows. */
export const DATASET_TTL_MS: Record<WarehouseDataset, number> = {
  quote: 5 * 60_000,
  profile: 24 * 60 * 60_000,
  peers: 24 * 60 * 60_000,
  income_annual: 24 * 60 * 60_000,
  income_quarter: 12 * 60 * 60_000,
  income_ttm: 12 * 60 * 60_000,
  balance_annual: 24 * 60 * 60_000,
  balance_quarter: 12 * 60 * 60_000,
  balance_ttm: 12 * 60 * 60_000,
  cashflow_annual: 24 * 60 * 60_000,
  cashflow_quarter: 12 * 60 * 60_000,
  cashflow_ttm: 12 * 60 * 60_000,
  ratios_ttm: 24 * 60 * 60_000,
  ratios_annual: 24 * 60 * 60_000,
  key_metrics_ttm: 24 * 60 * 60_000,
  key_metrics_annual: 24 * 60 * 60_000,
  financial_scores: 24 * 60 * 60_000,
  enterprise_values: 24 * 60 * 60_000,
  owner_earnings: 24 * 60 * 60_000,
  growth: 24 * 60 * 60_000,
  estimates: 12 * 60 * 60_000,
  street_consensus: 12 * 60 * 60_000,
  dcf: 24 * 60 * 60_000,
  price_daily: 60 * 60_000,
  price_hourly: 45 * 60_000,
  investor_events: 12 * 60 * 60_000,
};

/**
 * How long to wait before retrying an endpoint that returned empty from FMP.
 * Prevents perpetual refetch of unsupported TTM/estimates endpoints.
 */
export const EMPTY_RETRY_TTL_MS: Partial<Record<WarehouseDataset, number>> = {
  income_ttm: 24 * 60 * 60_000,
  balance_ttm: 24 * 60 * 60_000,
  cashflow_ttm: 24 * 60 * 60_000,
  estimates: 24 * 60 * 60_000,
  street_consensus: 24 * 60 * 60_000,
  owner_earnings: 24 * 60 * 60_000,
  dcf: 12 * 60 * 60_000,
  growth: 12 * 60 * 60_000,
  investor_events: 24 * 60 * 60_000,
};

/**
 * Bump when estimates ingest query shape changes so stale `fmp_empty`
 * markers (e.g. no-period 400s) are ignored and FMP is refetched.
 */
export const ESTIMATES_EMPTY_TOKEN = "fmp_empty:analyst_estimates_period_v1";

export const STREET_CONSENSUS_EMPTY_TOKEN = "fmp_empty:street_consensus_v1";

/** How long past TTL we still serve stale data when FMP fails. */
export const STALE_GRACE_MS = 7 * 24 * 60 * 60_000;

/** Clock-skew / parse tolerance. */
const FRESHNESS_SKEW_MS = 5_000;

/**
 * Parse Supabase / Postgres timestamps robustly.
 * Handles ISO, offset, and "YYYY-MM-DD HH:MM:SS+00" forms.
 */
export function parseWarehouseTime(
  value: string | Date | null | undefined,
): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;

  let s = value.trim();
  // Postgres style: "2026-08-02 16:18:00.123456+00" → ISO
  if (/^\d{4}-\d{2}-\d{2} /.test(s)) {
    s = s.replace(" ", "T");
  }
  // "+00" → "+00:00"
  if (/[+-]\d{2}$/.test(s)) {
    s = `${s}:00`;
  }
  // Bare UTC without zone — treat as UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    s = `${s}Z`;
  }

  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export function ageMs(
  updatedAt: string | Date | null | undefined,
): number | null {
  const t = parseWarehouseTime(updatedAt);
  if (t == null) return null;
  return Date.now() - t;
}

export function isFresh(
  updatedAt: string | Date | null | undefined,
  ttlMs: number,
): boolean {
  const age = ageMs(updatedAt);
  if (age == null) return false;
  // Future timestamp (clock skew) → treat as fresh
  if (age < -FRESHNESS_SKEW_MS) return true;
  return age <= ttlMs + FRESHNESS_SKEW_MS;
}

export function isUsableStale(
  updatedAt: string | Date | null | undefined,
  ttlMs: number,
): boolean {
  const age = ageMs(updatedAt);
  if (age == null) return false;
  if (age < 0) return true;
  return age < ttlMs + STALE_GRACE_MS;
}

/** Pick the newest of several timestamps (ISO strings). */
export function newestTimestamp(
  ...values: Array<string | Date | null | undefined>
): string | null {
  let best: string | null = null;
  let bestT = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    const t = parseWarehouseTime(v);
    if (t == null) continue;
    if (t >= bestT) {
      bestT = t;
      best =
        typeof v === "string"
          ? v
          : v instanceof Date
            ? v.toISOString()
            : null;
    }
  }
  return best;
}

export function emptyRetryTtl(dataset: WarehouseDataset): number {
  return EMPTY_RETRY_TTL_MS[dataset] ?? DATASET_TTL_MS[dataset];
}
