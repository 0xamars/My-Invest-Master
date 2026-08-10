import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { JsonRow } from "@/lib/market-data/warehouse/types";
import type { OhlcBar } from "@/lib/analysis/rating/types";
import type { WarehouseDataset } from "@/lib/market-data/warehouse/ttl";

type Admin = SupabaseClient;

function adminOrNull(): Admin | null {
  return createAdminClient() as Admin | null;
}

function logStoreError(op: string, error: { message: string } | null) {
  if (error && process.env.NODE_ENV === "development") {
    console.warn(`[warehouse:store] ${op} failed:`, error.message);
  }
}

export async function ensureMarketSymbol(input: {
  symbol: string;
  name?: string | null;
  assetType?: string;
  exchange?: string | null;
  currency?: string | null;
}): Promise<boolean> {
  const sb = adminOrNull();
  if (!sb) return false;
  const { error } = await sb.from("market_symbols").upsert(
    {
      symbol: input.symbol.toUpperCase(),
      name: input.name ?? null,
      asset_type: input.assetType ?? "stock",
      exchange: input.exchange ?? null,
      currency: input.currency ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "symbol" },
  );
  logStoreError("ensureMarketSymbol", error);
  return !error;
}

export async function upsertRefreshState(input: {
  symbol: string;
  dataset: WarehouseDataset | string;
  status: "ok" | "stale" | "error" | "empty";
  errorMessage?: string | null;
  success?: boolean;
}): Promise<void> {
  const sb = adminOrNull();
  if (!sb) return;
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    symbol: input.symbol.toUpperCase(),
    dataset: input.dataset,
    last_attempt_at: now,
    // Prefer explicit 'empty' when migration 009 applied; 'ok'+fmp_empty works either way
    status: input.status,
    error_message:
      input.status === "empty"
        ? input.errorMessage ?? "fmp_empty"
        : (input.errorMessage ?? null),
  };
  if (input.success || input.status === "empty") {
    row.last_success_at = now;
  }
  let { error } = await sb.from("data_refresh_state").upsert(row, {
    onConflict: "symbol,dataset",
  });
  // Fallback if DB check constraint does not yet allow status='empty'
  if (error && input.status === "empty") {
    const retry = await sb.from("data_refresh_state").upsert(
      {
        ...row,
        status: "ok",
        error_message: "fmp_empty",
      },
      { onConflict: "symbol,dataset" },
    );
    error = retry.error;
  }
  logStoreError(`upsertRefreshState ${input.dataset}`, error);
}

export async function getRefreshState(
  symbol: string,
  dataset: string,
): Promise<{
  last_success_at: string | null;
  last_attempt_at: string | null;
  status: string;
  error_message: string | null;
} | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data, error } = await sb
    .from("data_refresh_state")
    .select("last_success_at, last_attempt_at, status, error_message")
    .eq("symbol", symbol.toUpperCase())
    .eq("dataset", dataset)
    .maybeSingle();
  logStoreError(`getRefreshState ${dataset}`, error);
  return data;
}

/** Persist that FMP returned empty for this dataset (negative cache). */
export async function writeEmptyMarker(input: {
  symbol: string;
  dataset: string;
  periodType?: string;
}): Promise<void> {
  const sb = adminOrNull();
  if (!sb) return;
  const now = new Date().toISOString();
  const { error } = await sb.from("company_metrics").upsert(
    {
      symbol: input.symbol.toUpperCase(),
      dataset: input.dataset,
      period_type: input.periodType ?? "na",
      data: { __empty: true, recordedAt: now },
      source: "fmp",
      as_of: now,
      updated_at: now,
    },
    { onConflict: "symbol,dataset,period_type" },
  );
  logStoreError(`writeEmptyMarker ${input.dataset}`, error);
}

export function isEmptyMarker(data: unknown): boolean {
  return (
    !!data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    (data as { __empty?: boolean }).__empty === true
  );
}

export async function readProfile(symbol: string) {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data, error } = await sb
    .from("company_profiles")
    .select("*")
    .eq("symbol", symbol.toUpperCase())
    .maybeSingle();
  logStoreError("readProfile", error);
  return data;
}

export async function writeProfile(input: {
  symbol: string;
  sector: string | null;
  industry: string | null;
  country: string | null;
  description: string | null;
  raw: JsonRow | null;
}): Promise<void> {
  const sb = adminOrNull();
  if (!sb) return;
  const now = new Date().toISOString();
  await sb.from("company_profiles").upsert(
    {
      symbol: input.symbol.toUpperCase(),
      sector: input.sector,
      industry: input.industry,
      country: input.country,
      description: input.description,
      raw_payload: input.raw,
      as_of: now,
      updated_at: now,
    },
    { onConflict: "symbol" },
  );
}

export async function readQuote(symbol: string) {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data, error } = await sb
    .from("market_quotes")
    .select("*")
    .eq("symbol", symbol.toUpperCase())
    .maybeSingle();
  logStoreError("readQuote", error);
  return data;
}

export async function writeQuote(input: {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  raw: JsonRow | null;
}): Promise<void> {
  const sb = adminOrNull();
  if (!sb) return;
  const now = new Date().toISOString();
  await sb.from("market_quotes").upsert(
    {
      symbol: input.symbol.toUpperCase(),
      price: input.price,
      change: input.change,
      change_percent: input.changePercent,
      market_cap: input.marketCap,
      raw_payload: input.raw,
      as_of: now,
      updated_at: now,
    },
    { onConflict: "symbol" },
  );
}

export async function readStatements(
  symbol: string,
  statementType: "income" | "balance" | "cashflow",
  periodType: "annual" | "quarter" | "ttm",
): Promise<{ rows: JsonRow[]; updatedAt: string | null }> {
  const sb = adminOrNull();
  if (!sb) return { rows: [], updatedAt: null };
  const { data, error } = await sb
    .from("financial_statements")
    .select("data, updated_at, fiscal_date")
    .eq("symbol", symbol.toUpperCase())
    .eq("statement_type", statementType)
    .eq("period_type", periodType)
    .order("fiscal_date", { ascending: false });
  logStoreError(`readStatements ${statementType}/${periodType}`, error);
  if (!data?.length) return { rows: [], updatedAt: null };
  return {
    rows: data.map((r) => r.data as JsonRow),
    updatedAt: data[0]?.updated_at ?? null,
  };
}

export async function writeStatements(input: {
  symbol: string;
  statementType: "income" | "balance" | "cashflow";
  periodType: "annual" | "quarter" | "ttm";
  rows: Array<{
    fiscalDate: string;
    periodLabel: string | null;
    data: JsonRow;
  }>;
}): Promise<void> {
  const sb = adminOrNull();
  if (!sb || input.rows.length === 0) return;
  const now = new Date().toISOString();
  const payload = input.rows.map((r) => ({
    symbol: input.symbol.toUpperCase(),
    statement_type: input.statementType,
    period_type: input.periodType,
    fiscal_date: r.fiscalDate,
    period_label: r.periodLabel,
    data: r.data,
    source: "fmp",
    updated_at: now,
  }));
  await sb.from("financial_statements").upsert(payload, {
    onConflict: "symbol,statement_type,period_type,fiscal_date",
  });
}

export async function readRatios(
  symbol: string,
  periodType: "annual" | "quarter" | "ttm",
): Promise<{ rows: JsonRow[]; updatedAt: string | null }> {
  const sb = adminOrNull();
  if (!sb) return { rows: [], updatedAt: null };
  const { data } = await sb
    .from("financial_ratios")
    .select("data, updated_at, fiscal_date")
    .eq("symbol", symbol.toUpperCase())
    .eq("period_type", periodType)
    .order("fiscal_date", { ascending: false });
  if (!data?.length) return { rows: [], updatedAt: null };
  return {
    rows: data.map((r) => r.data as JsonRow),
    updatedAt: data[0]?.updated_at ?? null,
  };
}

export async function writeRatios(input: {
  symbol: string;
  periodType: "annual" | "quarter" | "ttm";
  rows: Array<{ fiscalDate: string; data: JsonRow }>;
}): Promise<void> {
  const sb = adminOrNull();
  if (!sb || input.rows.length === 0) return;
  const now = new Date().toISOString();
  await sb.from("financial_ratios").upsert(
    input.rows.map((r) => ({
      symbol: input.symbol.toUpperCase(),
      period_type: input.periodType,
      fiscal_date: r.fiscalDate,
      data: r.data,
      source: "fmp",
      updated_at: now,
    })),
    { onConflict: "symbol,period_type,fiscal_date" },
  );
}

export async function readMetrics(
  symbol: string,
  dataset: string,
  periodType = "na",
): Promise<{
  data: JsonRow | JsonRow[] | null;
  updatedAt: string | null;
  asOf: string | null;
}> {
  const sb = adminOrNull();
  if (!sb) return { data: null, updatedAt: null, asOf: null };
  const { data, error } = await sb
    .from("company_metrics")
    .select("data, updated_at, as_of")
    .eq("symbol", symbol.toUpperCase())
    .eq("dataset", dataset)
    .eq("period_type", periodType)
    .maybeSingle();
  logStoreError(`readMetrics ${dataset}`, error);
  if (!data) return { data: null, updatedAt: null, asOf: null };
  return {
    data: data.data as JsonRow | JsonRow[],
    updatedAt: data.updated_at,
    asOf: data.as_of,
  };
}

export async function writeMetrics(input: {
  symbol: string;
  dataset: string;
  periodType?: string;
  data: JsonRow | JsonRow[];
}): Promise<void> {
  const sb = adminOrNull();
  if (!sb) return;
  const now = new Date().toISOString();
  const { error } = await sb.from("company_metrics").upsert(
    {
      symbol: input.symbol.toUpperCase(),
      dataset: input.dataset,
      period_type: input.periodType ?? "na",
      data: input.data,
      source: "fmp",
      as_of: now,
      updated_at: now,
    },
    { onConflict: "symbol,dataset,period_type" },
  );
  logStoreError(`writeMetrics ${input.dataset}`, error);
}

export async function readPriceHistory(
  symbol: string,
  timeframe: string,
): Promise<{ bars: OhlcBar[]; updatedAt: string | null }> {
  const sb = adminOrNull();
  if (!sb) return { bars: [], updatedAt: null };
  const { data } = await sb
    .from("price_history")
    .select("data, updated_at")
    .eq("symbol", symbol.toUpperCase())
    .eq("timeframe", timeframe)
    .maybeSingle();
  if (!data) return { bars: [], updatedAt: null };
  const bars = Array.isArray(data.data) ? (data.data as OhlcBar[]) : [];
  return { bars, updatedAt: data.updated_at };
}

export async function writePriceHistory(input: {
  symbol: string;
  timeframe: string;
  bars: OhlcBar[];
}): Promise<void> {
  const sb = adminOrNull();
  if (!sb) return;
  await sb.from("price_history").upsert(
    {
      symbol: input.symbol.toUpperCase(),
      timeframe: input.timeframe,
      data: input.bars,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "symbol,timeframe" },
  );
}

export function isWarehouseWritable(): boolean {
  return adminOrNull() != null;
}
