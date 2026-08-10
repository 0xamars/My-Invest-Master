/**
 * FMP Analysis Package — assemble from Supabase warehouse, refreshing via FMP when stale.
 */
import type { AnalysisQuote } from "@/lib/analysis/types";
import type {
  FundamentalPeerContext,
  OhlcBar,
  PeerMetricRow,
} from "@/lib/analysis/rating/types";
import { isFmpConfigured } from "@/lib/market-data/config";
import { isFmpRateLimited, num, str } from "@/lib/market-data/fmp/client";
import {
  INDUSTRY_PEER_SEEDS,
  MAX_PEERS_FETCH,
  SECTOR_PEER_SEEDS,
} from "@/lib/analysis/rating/peer-universe";
import { toIndustryKey } from "@/lib/market-data/industry-overrides";
import { buildFundamentalInputsFromPackage } from "@/lib/market-data/warehouse/build-fundamentals";
import {
  formatSubstitutionNotes,
  resolveFundamentalInputs,
} from "@/lib/analysis/rating/resolve-inputs";
import {
  fiscalDateFromRow,
  fmpFetchBalance,
  fmpFetchBalanceTtm,
  fmpFetchCashflow,
  fmpFetchCashflowTtm,
  fmpFetchDailyHistory,
  fmpFetchDcf,
  fmpFetchEnterpriseValues,
  fmpFetchEstimatesBundle,
  fmpFetchStreetConsensusBundle,
  fmpFetchFinancialScores,
  fmpFetchGrowth,
  fmpFetchHourlyHistory,
  fmpFetchInsiderTrading,
  fmpFetchMergersAcquisitions,
  fmpFetchIncome,
  fmpFetchIncomeTtm,
  fmpFetchKeyMetricsAnnual,
  fmpFetchKeyMetricsTtm,
  fmpFetchOwnerEarnings,
  fmpFetchProfileRaw,
  fmpFetchQuoteRaw,
  fmpFetchRatiosAnnual,
  fmpFetchRatiosTtm,
  fmpFetchStockPeers,
  periodLabelFromRow,
} from "@/lib/market-data/warehouse/fmp-ingest";
import * as store from "@/lib/market-data/warehouse/store";
import {
  DATASET_TTL_MS,
  ESTIMATES_EMPTY_TOKEN,
  STREET_CONSENSUS_EMPTY_TOKEN,
  ageMs,
  emptyRetryTtl,
  isFresh,
  isUsableStale,
  newestTimestamp,
  type WarehouseDataset,
} from "@/lib/market-data/warehouse/ttl";
import { buildEstimateOutlook } from "@/lib/market-data/warehouse/estimate-outlook";
import { buildAnalysisForecast } from "@/lib/analysis/forecast";
import type { AnalysisRecentEvent } from "@/lib/analysis/recent-events";
import {
  mergerSearchName,
  summarizeInsiderTrading,
  summarizeMergers,
} from "@/lib/market-data/warehouse/investor-events";
import type {
  AnalysisPackage,
  JsonRow,
  PackageDatasetStatus,
  StatementPeriod,
} from "@/lib/market-data/warehouse/types";
import { isMarketWarehouseConfigured } from "@/lib/supabase/admin";

const packageInflight = new Map<string, Promise<AnalysisPackage>>();

type LoadResult<T> = {
  value: T;
  source: PackageDatasetStatus["source"];
  updatedAt: string | null;
  error?: string;
};

function emptyStatements(): AnalysisPackage["statements"] {
  const blank = (): Record<StatementPeriod, JsonRow[]> => ({
    annual: [],
    quarter: [],
    ttm: [],
  });
  return { income: blank(), balance: blank(), cashflow: blank() };
}

function emptyPeerContext(
  industryKey: string | null,
  industry: string | null,
  sectorKey: string | null,
  sector: string | null,
): FundamentalPeerContext {
  return {
    basis: "none",
    label: "No peer set",
    peerCount: 0,
    industryKey,
    industry,
    sectorKey,
    sector,
  };
}

function isStatementCacheEmpty(rows: JsonRow[]): boolean {
  if (!rows.length) return true;
  return rows.every((r) => r.__empty === true);
}

function liveStatementRows(rows: JsonRow[]): JsonRow[] {
  return rows.filter((r) => r.__empty !== true);
}

async function loadOrRefresh<T>(input: {
  symbol: string;
  dataset: WarehouseDataset;
  read: () => Promise<{ value: T; updatedAt: string | null }>;
  isEmpty: (value: T) => boolean;
  fetchFmp: () => Promise<T>;
  write: (value: T) => Promise<void>;
  /** Optional: persist empty FMP result so freshness has a row timestamp. */
  writeEmpty?: () => Promise<void>;
  /**
   * When set, only this exact refresh error_message counts as confirmed-empty.
   * Stale `fmp_empty` markers from a prior ingest bug are ignored.
   */
  emptyErrorToken?: string;
}): Promise<LoadResult<T>> {
  const ttl = DATASET_TTL_MS[input.dataset];
  const emptyTtl = emptyRetryTtl(input.dataset);
  const cached = await input.read();
  const refresh = await store.getRefreshState(input.symbol, input.dataset);
  const checkedAt = newestTimestamp(
    refresh?.last_success_at,
    refresh?.last_attempt_at,
  );
  const emptyConfirmed = input.emptyErrorToken
    ? refresh?.error_message === input.emptyErrorToken
    : refresh?.status === "empty" ||
      refresh?.error_message === "fmp_empty" ||
      refresh?.error_message?.startsWith("fmp_empty") === true;

  const rowAge = ageMs(cached.updatedAt);
  const checkAge = ageMs(checkedAt);

  const log = (msg: string, extra?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "development") return;
    console.info(`[warehouse:${input.dataset}] ${input.symbol} ${msg}`, {
      rowAgeSec: rowAge != null ? Math.round(rowAge / 1000) : null,
      checkAgeSec: checkAge != null ? Math.round(checkAge / 1000) : null,
      ttlSec: Math.round(ttl / 1000),
      ...extra,
    });
  };

  const hasRow = !input.isEmpty(cached.value);

  // 1) Non-empty row within TTL
  if (hasRow && isFresh(cached.updatedAt, ttl)) {
    log("HIT fresh");
    return {
      value: cached.value,
      source: "supabase",
      updatedAt: cached.updatedAt,
    };
  }

  // 2) Recently confirmed empty — do not refetch until emptyRetry TTL
  if (emptyConfirmed && checkedAt && isFresh(checkedAt, emptyTtl)) {
    log("HIT empty-cached", { emptyTtlSec: Math.round(emptyTtl / 1000) });
    return {
      value: cached.value,
      source: "supabase",
      updatedAt: checkedAt,
    };
  }

  // 3) Refresh-state still fresh (successful check) even if row clock looked expired
  if (checkedAt && isFresh(checkedAt, ttl) && hasRow) {
    log("HIT fresh (refresh-state)");
    return {
      value: cached.value,
      source: "supabase",
      updatedAt: newestTimestamp(cached.updatedAt, checkedAt),
    };
  }

  // 4) Need network — classify miss reason
  const canFetch = isFmpConfigured() && !isFmpRateLimited();
  if (canFetch) {
    try {
      if (hasRow) {
        log("MISS expired → fetch FMP", {
          updatedAt: cached.updatedAt,
          checkedAt,
        });
      } else if (emptyConfirmed) {
        log("MISS empty-retry → fetch FMP", { checkedAt });
      } else {
        log("MISS missing → fetch FMP", { checkedAt });
      }

      const fresh = await input.fetchFmp();

      if (!input.isEmpty(fresh)) {
        await input.write(fresh);
        await store.upsertRefreshState({
          symbol: input.symbol,
          dataset: input.dataset,
          status: "ok",
          success: true,
        });
        log("WROTE supabase from FMP");
        return {
          value: fresh,
          source: "fmp",
          updatedAt: new Date().toISOString(),
        };
      }

      // FMP returned empty
      await store.upsertRefreshState({
        symbol: input.symbol,
        dataset: input.dataset,
        status: "empty",
        errorMessage: input.emptyErrorToken ?? "fmp_empty",
        success: true,
      });
      if (input.writeEmpty) {
        await input.writeEmpty();
      }
      log("FMP empty — recorded negative cache");

      if (hasRow && isUsableStale(cached.updatedAt, ttl)) {
        return {
          value: cached.value,
          source: "stale",
          updatedAt: cached.updatedAt,
          error: "FMP returned empty; serving prior cache",
        };
      }

      return {
        value: fresh,
        source: "fmp",
        updatedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "FMP fetch failed";
      await store.upsertRefreshState({
        symbol: input.symbol,
        dataset: input.dataset,
        status: "error",
        errorMessage: message,
        success: false,
      });
      if (hasRow && isUsableStale(cached.updatedAt, ttl)) {
        log("HIT stale (FMP error)", { message });
        return {
          value: cached.value,
          source: "stale",
          updatedAt: cached.updatedAt,
          error: message,
        };
      }
      log("MISS missing (FMP error)", { message });
      return {
        value: cached.value,
        source: "missing",
        updatedAt: cached.updatedAt,
        error: message,
      };
    }
  }

  if (hasRow && isUsableStale(cached.updatedAt, ttl)) {
    log("HIT stale (FMP unavailable)");
    return {
      value: cached.value,
      source: "stale",
      updatedAt: cached.updatedAt,
      error: "FMP unavailable — serving stale cache",
    };
  }

  log("MISS missing");
  return {
    value: cached.value,
    source: "missing",
    updatedAt: cached.updatedAt,
  };
}

async function writeStatementBundle(
  symbol: string,
  statementType: "income" | "balance" | "cashflow",
  periodType: StatementPeriod,
  rows: JsonRow[],
) {
  await store.writeStatements({
    symbol,
    statementType,
    periodType,
    rows: rows.map((data) => ({
      fiscalDate: fiscalDateFromRow(data),
      periodLabel: periodLabelFromRow(data),
      data,
    })),
  });
}

function peerRowFromRatios(
  symbol: string,
  r: JsonRow,
  industryKey: string | null,
  sectorKey: string | null,
): PeerMetricRow {
  let debtToEquity =
    num(r.debtEquityRatioTTM) ??
    num(r.debtToEquityRatioTTM) ??
    num(r.debtToEquityTTM) ??
    num(r.debtEquityRatio) ??
    num(r.debtToEquityRatio) ??
    num(r.debtToEquity);
  if (debtToEquity != null && Math.abs(debtToEquity) < 5) {
    debtToEquity *= 100;
  }
  return {
    symbol,
    industryKey,
    sectorKey,
    debtToEquity,
    currentRatio: num(r.currentRatioTTM) ?? num(r.currentRatio),
    operatingMargins:
      num(r.operatingProfitMarginTTM) ??
      num(r.ebitMarginTTM) ??
      num(r.operatingProfitMargin),
    profitMargins:
      num(r.netProfitMarginTTM) ??
      num(r.continuousOperationsProfitMarginTTM) ??
      num(r.netProfitMargin),
    grossMargins: num(r.grossProfitMarginTTM) ?? num(r.grossProfitMargin),
    returnOnEquity: num(r.returnOnEquityTTM) ?? num(r.returnOnEquity),
    returnOnAssets: num(r.returnOnAssetsTTM) ?? num(r.returnOnAssets),
    returnOnInvestedCapital:
      num(r.returnOnCapitalEmployedTTM) ??
      num(r.returnOnCapitalEmployed) ??
      num(r.roicTTM) ??
      num(r.roic) ??
      num(r.returnOnInvestedCapitalTTM) ??
      num(r.returnOnInvestedCapital),
    revenueGrowth: null,
    earningsGrowth: null,
    trailingPE:
      num(r.priceToEarningsDilutedRatioTTM) ??
      num(r.priceToEarningsRatioTTM) ??
      num(r.peRatioTTM) ??
      num(r.priceEarningsRatioTTM) ??
      num(r.priceToEarningsDilutedRatio) ??
      num(r.priceToEarningsRatio) ??
      num(r.peRatio) ??
      num(r.priceEarningsRatio),
    enterpriseToEbitda:
      num(r.enterpriseValueMultipleTTM) ??
      num(r.enterpriseValueMultiple) ??
      num(r.evToEBITDATTM) ??
      num(r.evToEBITDA) ??
      num(r.enterpriseValueOverEBITDATTM),
    priceToSales: num(r.priceToSalesRatioTTM) ?? num(r.priceToSalesRatio),
    priceToFcf:
      num(r.priceToFreeCashFlowsRatioTTM) ??
      num(r.priceToFreeCashFlowRatioTTM) ??
      num(r.priceToFreeCashFlowsRatio) ??
      num(r.priceToFreeCashFlowRatio),
    pegRatio:
      num(r.pegRatioTTM) ??
      num(r.priceToEarningsGrowthRatioTTM) ??
      num(r.priceToEarningsDilutedGrowthRatioTTM) ??
      num(r.forwardPriceToEarningsGrowthRatioTTM) ??
      num(r.pegRatio) ??
      num(r.priceToEarningsGrowthRatio),
    sbcToRevenue:
      num(r.stockBasedCompensationToRevenueTTM) ??
      num(r.stockCompensationToRevenueTTM) ??
      num(r.stockBasedCompensationToRevenue) ??
      null,
  };
}

async function loadInvestorEvents(
  symbol: string,
  companyName: string | null,
): Promise<LoadResult<{ events: AnalysisRecentEvent[] }>> {
  return loadOrRefresh({
    symbol,
    dataset: "investor_events",
    read: async () => {
      const { data, updatedAt } = await store.readMetrics(
        symbol,
        "investor_events",
      );
      if (!data || typeof data !== "object") {
        return { value: { events: [] as AnalysisRecentEvent[] }, updatedAt };
      }
      const payload = data as { events?: AnalysisRecentEvent[] };
      const events = Array.isArray(payload.events)
        ? payload.events.filter(
            (e) =>
              e &&
              (e.type === "insider" || e.type === "ma") &&
              typeof e.summary === "string" &&
              e.summary.trim(),
          )
        : [];
      return { value: { events }, updatedAt };
    },
    isEmpty: (v) => v.events.length === 0,
    fetchFmp: async () => {
      const events: AnalysisRecentEvent[] = [];
      try {
        const insiderRows = await fmpFetchInsiderTrading(symbol);
        const insider = summarizeInsiderTrading(insiderRows);
        if (insider) events.push(insider);
      } catch {
        /* skip — optional context */
      }
      try {
        const q = mergerSearchName(companyName);
        if (q) {
          const maRows = await fmpFetchMergersAcquisitions(q);
          events.push(...summarizeMergers(maRows, symbol));
        }
      } catch {
        /* skip — optional context */
      }
      return { events };
    },
    write: async (value) => {
      await store.writeMetrics({
        symbol,
        dataset: "investor_events",
        data: value as unknown as JsonRow,
      });
    },
    writeEmpty: async () => {
      await store.writeEmptyMarker({ symbol, dataset: "investor_events" });
    },
  });
}

async function loadPeers(
  symbol: string,
  industryKey: string | null,
  industry: string | null,
  sectorKey: string | null,
  sector: string | null,
): Promise<LoadResult<{ peers: PeerMetricRow[]; context: FundamentalPeerContext }>> {
  return loadOrRefresh({
    symbol,
    dataset: "peers",
    read: async () => {
      const { data, updatedAt } = await store.readMetrics(symbol, "peers");
      if (!data || typeof data !== "object") {
        return {
          value: {
            peers: [] as PeerMetricRow[],
            context: emptyPeerContext(industryKey, industry, sectorKey, sector),
          },
          updatedAt,
        };
      }
      const payload = data as {
        peers?: PeerMetricRow[];
        context?: FundamentalPeerContext;
      };
      return {
        value: {
          peers: payload.peers ?? [],
          context:
            payload.context ??
            emptyPeerContext(industryKey, industry, sectorKey, sector),
        },
        updatedAt,
      };
    },
    isEmpty: (v) => v.peers.length === 0,
    fetchFmp: async () => {
      let symbols = (await fmpFetchStockPeers(symbol)).filter(
        (s) => s !== symbol.toUpperCase(),
      );
      if (symbols.length < 3) {
        const seeds =
          (industryKey && INDUSTRY_PEER_SEEDS[industryKey]) ||
          (sectorKey && SECTOR_PEER_SEEDS[sectorKey]) ||
          [];
        symbols = [
          ...new Set([...symbols, ...seeds.map((s) => s.toUpperCase())]),
        ]
          .filter((s) => s !== symbol.toUpperCase())
          .slice(0, MAX_PEERS_FETCH);
      } else {
        symbols = symbols.slice(0, MAX_PEERS_FETCH);
      }

      const peers: PeerMetricRow[] = [];
      for (const peer of symbols) {
        if (isFmpRateLimited()) break;
        const ratios = await fmpFetchRatiosTtm(peer);
        const row = ratios[0];
        if (!row) continue;
        peers.push(peerRowFromRatios(peer, row, industryKey, sectorKey));
      }

      const basis =
        peers.length >= 3
          ? industryKey
            ? "sub_industry"
            : "sector"
          : "none";
      const context: FundamentalPeerContext = {
        basis: basis === "none" ? "none" : basis,
        label:
          peers.length > 0
            ? `${industry ?? sector ?? "Peers"} · ${peers.length} peers`
            : "No peer set",
        peerCount: peers.length,
        industryKey,
        industry,
        sectorKey,
        sector,
      };
      return { peers, context };
    },
    write: async (value) => {
      await store.writeMetrics({
        symbol,
        dataset: "peers",
        data: value as unknown as JsonRow,
      });
    },
  });
}

/**
 * Get the shared Analysis Package for a stock symbol.
 * Reads Supabase first; fetches FMP only for missing/stale datasets.
 */
export async function getAnalysisPackage(
  symbol: string,
  options?: { includeHourly?: boolean },
): Promise<AnalysisPackage> {
  const upper = symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  const existing = packageInflight.get(upper);
  if (existing) return existing;

  const run = buildAnalysisPackage(upper, options);
  packageInflight.set(upper, run);
  try {
    return await run;
  } finally {
    packageInflight.delete(upper);
  }
}

async function buildAnalysisPackage(
  symbol: string,
  options?: { includeHourly?: boolean },
): Promise<AnalysisPackage> {
  const includeHourly = options?.includeHourly !== false;
  const status: PackageDatasetStatus[] = [];
  const warehouseOn = isMarketWarehouseConfigured();

  if (!warehouseOn && process.env.NODE_ENV === "development") {
    console.warn(
      "[warehouse] SUPABASE_SERVICE_ROLE_KEY not set — package will use FMP memory cache only (no Supabase persist)",
    );
  }

  // Profile + quote first (needed for symbol row + peer framing)
  const profileLoad = await loadOrRefresh({
    symbol,
    dataset: "profile",
    read: async () => {
      const row = await store.readProfile(symbol);
      if (!row) return { value: null, updatedAt: null };
      const raw = (row.raw_payload as JsonRow) ?? null;
      const name =
        (raw && (str(raw.name) ?? str(raw.companyName))) ||
        null;
      const marketCap =
        (raw && (num(raw.marketCap) ?? num(raw.mktCap))) || null;
      const exchange =
        (raw &&
          (str(raw.exchange) ?? str(raw.exchangeShortName))) ||
        null;
      const currency = (raw && str(raw.currency)) || null;
      const country = (row.country as string | null) ?? (raw && str(raw.country)) ?? null;
      return {
        value: {
          name,
          sector: row.sector as string | null,
          sectorKey: toIndustryKey(row.sector as string | null),
          industry: row.industry as string | null,
          industryKey: toIndustryKey(row.industry as string | null),
          country,
          exchange,
          currency,
          description: row.description as string | null,
          marketCap,
          isEtf:
            raw && typeof raw.isEtf === "boolean"
              ? (raw.isEtf as boolean)
              : raw && typeof raw.isETF === "boolean"
                ? (raw.isETF as boolean)
                : null,
          isFund:
            raw && typeof raw.isFund === "boolean"
              ? (raw.isFund as boolean)
              : raw && typeof raw.isMutualFund === "boolean"
                ? (raw.isMutualFund as boolean)
                : null,
          raw,
        },
        updatedAt: (row.updated_at as string) ?? null,
      };
    },
    isEmpty: (v) => v == null,
    fetchFmp: async () => {
      const p = await fmpFetchProfileRaw(symbol);
      if (!p) return null;
      return {
        name: p.name,
        sector: p.sector,
        sectorKey: p.sectorKey,
        industry: p.industry,
        industryKey: p.industryKey,
        country: null,
        exchange: p.exchange,
        currency: p.currency,
        description: p.description,
        marketCap: p.marketCap,
        isEtf: p.isEtf,
        isFund: p.isFund,
        raw: p.raw ?? (p as unknown as JsonRow),
      };
    },
    write: async (v) => {
      if (!v) return;
      await store.ensureMarketSymbol({
        symbol,
        name: v.name,
        exchange: v.exchange,
        currency: v.currency,
      });
      await store.writeProfile({
        symbol,
        sector: v.sector,
        industry: v.industry,
        country: v.country,
        description: v.description,
        raw: v.raw,
      });
    },
  });
  status.push({
    dataset: "profile",
    source: profileLoad.source,
    updatedAt: profileLoad.updatedAt,
    error: profileLoad.error,
  });

  await store.ensureMarketSymbol({
    symbol,
    name: profileLoad.value?.name,
    exchange: profileLoad.value?.exchange,
    currency: profileLoad.value?.currency,
  });

  const quoteLoad = await loadOrRefresh({
    symbol,
    dataset: "quote",
    read: async () => {
      const row = await store.readQuote(symbol);
      if (!row) return { value: null as AnalysisQuote | null, updatedAt: null };
      const q: AnalysisQuote = {
        symbol,
        name: profileLoad.value?.name ?? symbol,
        type: "stock",
        price: row.price as number | null,
        change: row.change as number | null,
        changePercent: row.change_percent as number | null,
        marketCap: row.market_cap as number | null,
        volume: null,
        averageVolume: null,
        dayLow: null,
        dayHigh: null,
        week52Low: null,
        week52High: null,
        currency: profileLoad.value?.currency ?? "USD",
        fetchedAt: (row.as_of as string) ?? (row.updated_at as string),
        description: profileLoad.value?.description ?? null,
      };
      return {
        value: q,
        updatedAt: newestTimestamp(
          row.as_of as string | null,
          row.updated_at as string | null,
        ),
      };
    },
    isEmpty: (v) => v == null || v.price == null,
    fetchFmp: async () => {
      const q = await fmpFetchQuoteRaw(symbol);
      if (!q || q.price == null) return null;
      const quote: AnalysisQuote = {
        symbol: q.symbol,
        name: q.name ?? profileLoad.value?.name ?? symbol,
        type: "stock",
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        marketCap: q.marketCap,
        volume: q.volume,
        averageVolume: q.averageVolume,
        dayLow: q.dayLow,
        dayHigh: q.dayHigh,
        week52Low: q.week52Low,
        week52High: q.week52High,
        currency: q.currency ?? "USD",
        fetchedAt: new Date().toISOString(),
        description: profileLoad.value?.description ?? null,
      };
      return quote;
    },
    write: async (v) => {
      if (!v) return;
      await store.writeQuote({
        symbol,
        price: v.price,
        change: v.change,
        changePercent: v.changePercent,
        marketCap: v.marketCap,
        raw: v as unknown as JsonRow,
      });
    },
  });
  status.push({
    dataset: "quote",
    source: quoteLoad.source,
    updatedAt: quoteLoad.updatedAt,
    error: quoteLoad.error,
  });

  // Statements + metrics in parallel
  const statementJobs = [
    ["income", "annual", "income_annual", () => fmpFetchIncome(symbol, "annual")] as const,
    ["income", "quarter", "income_quarter", () => fmpFetchIncome(symbol, "quarter")] as const,
    ["income", "ttm", "income_ttm", () => fmpFetchIncomeTtm(symbol)] as const,
    ["balance", "annual", "balance_annual", () => fmpFetchBalance(symbol, "annual")] as const,
    ["balance", "quarter", "balance_quarter", () => fmpFetchBalance(symbol, "quarter")] as const,
    ["balance", "ttm", "balance_ttm", () => fmpFetchBalanceTtm(symbol)] as const,
    ["cashflow", "annual", "cashflow_annual", () => fmpFetchCashflow(symbol, "annual")] as const,
    ["cashflow", "quarter", "cashflow_quarter", () => fmpFetchCashflow(symbol, "quarter")] as const,
    ["cashflow", "ttm", "cashflow_ttm", () => fmpFetchCashflowTtm(symbol)] as const,
  ];

  const statements = emptyStatements();

  await Promise.all(
    statementJobs.map(async ([stype, ptype, dataset, fetchFn]) => {
      const loaded = await loadOrRefresh({
        symbol,
        dataset,
        read: async () => {
          const { rows, updatedAt } = await store.readStatements(
            symbol,
            stype,
            ptype,
          );
          return { value: rows, updatedAt };
        },
        isEmpty: isStatementCacheEmpty,
        fetchFmp: fetchFn,
        write: (rows) => writeStatementBundle(symbol, stype, ptype, rows),
        writeEmpty: async () => {
          await writeStatementBundle(symbol, stype, ptype, [
            { __empty: true, recordedAt: new Date().toISOString() },
          ]);
        },
      });
      statements[stype][ptype] = liveStatementRows(loaded.value);
      status.push({
        dataset,
        source: loaded.source,
        updatedAt: loaded.updatedAt,
        error: loaded.error,
      });
    }),
  );

  const ratiosTtmLoad = await loadOrRefresh({
    symbol,
    dataset: "ratios_ttm",
    read: async () => {
      const { rows, updatedAt } = await store.readRatios(symbol, "ttm");
      return { value: rows[0] ?? null, updatedAt };
    },
    isEmpty: (v) => v == null,
    fetchFmp: async () => (await fmpFetchRatiosTtm(symbol))[0] ?? null,
    write: async (row) => {
      if (!row) return;
      await store.writeRatios({
        symbol,
        periodType: "ttm",
        rows: [{ fiscalDate: "1970-01-01", data: row }],
      });
      await store.writeMetrics({
        symbol,
        dataset: "ratios_ttm",
        data: row,
      });
    },
  });
  status.push({
    dataset: "ratios_ttm",
    source: ratiosTtmLoad.source,
    updatedAt: ratiosTtmLoad.updatedAt,
    error: ratiosTtmLoad.error,
  });

  const ratiosAnnualLoad = await loadOrRefresh({
    symbol,
    dataset: "ratios_annual",
    read: async () => {
      const { rows, updatedAt } = await store.readRatios(symbol, "annual");
      return { value: rows, updatedAt };
    },
    isEmpty: (v) => v.length === 0,
    fetchFmp: () => fmpFetchRatiosAnnual(symbol),
    write: async (rows) => {
      await store.writeRatios({
        symbol,
        periodType: "annual",
        rows: rows.map((data) => ({
          fiscalDate: fiscalDateFromRow(data),
          data,
        })),
      });
    },
  });
  status.push({
    dataset: "ratios_annual",
    source: ratiosAnnualLoad.source,
    updatedAt: ratiosAnnualLoad.updatedAt,
    error: ratiosAnnualLoad.error,
  });

  const kmTtm = await loadOrRefresh({
    symbol,
    dataset: "key_metrics_ttm",
    read: async () => {
      const { data, updatedAt } = await store.readMetrics(
        symbol,
        "key_metrics_ttm",
      );
      const row = Array.isArray(data) ? data[0] : data;
      return { value: (row as JsonRow) ?? null, updatedAt };
    },
    isEmpty: (v) => v == null,
    fetchFmp: async () => (await fmpFetchKeyMetricsTtm(symbol))[0] ?? null,
    write: async (row) => {
      if (!row) return;
      await store.writeMetrics({
        symbol,
        dataset: "key_metrics_ttm",
        data: row,
      });
    },
  });
  status.push({
    dataset: "key_metrics_ttm",
    source: kmTtm.source,
    updatedAt: kmTtm.updatedAt,
    error: kmTtm.error,
  });

  const kmAnnual = await loadOrRefresh({
    symbol,
    dataset: "key_metrics_annual",
    read: async () => {
      const { data, updatedAt } = await store.readMetrics(
        symbol,
        "key_metrics",
        "annual",
      );
      const rows = Array.isArray(data) ? data : data ? [data as JsonRow] : [];
      return { value: rows, updatedAt };
    },
    isEmpty: (v) => v.length === 0,
    fetchFmp: () => fmpFetchKeyMetricsAnnual(symbol),
    write: async (rows) => {
      await store.writeMetrics({
        symbol,
        dataset: "key_metrics",
        periodType: "annual",
        data: rows,
      });
    },
  });
  status.push({
    dataset: "key_metrics_annual",
    source: kmAnnual.source,
    updatedAt: kmAnnual.updatedAt,
    error: kmAnnual.error,
  });

  const scoresLoad = await loadOrRefresh({
    symbol,
    dataset: "financial_scores",
    read: async () => {
      const { data, updatedAt } = await store.readMetrics(
        symbol,
        "financial_scores",
      );
      const row = Array.isArray(data) ? data[0] : data;
      return { value: (row as JsonRow) ?? null, updatedAt };
    },
    isEmpty: (v) => v == null,
    fetchFmp: async () => (await fmpFetchFinancialScores(symbol))[0] ?? null,
    write: async (row) => {
      if (!row) return;
      await store.writeMetrics({
        symbol,
        dataset: "financial_scores",
        data: row,
      });
    },
  });
  status.push({
    dataset: "financial_scores",
    source: scoresLoad.source,
    updatedAt: scoresLoad.updatedAt,
    error: scoresLoad.error,
  });

  const evLoad = await loadOrRefresh({
    symbol,
    dataset: "enterprise_values",
    read: async () => {
      const { data, updatedAt } = await store.readMetrics(
        symbol,
        "enterprise_values",
      );
      const rows = Array.isArray(data) ? data : data ? [data as JsonRow] : [];
      return { value: rows, updatedAt };
    },
    isEmpty: (v) => v.length === 0,
    fetchFmp: () => fmpFetchEnterpriseValues(symbol),
    write: async (rows) => {
      await store.writeMetrics({
        symbol,
        dataset: "enterprise_values",
        data: rows,
      });
    },
  });
  status.push({
    dataset: "enterprise_values",
    source: evLoad.source,
    updatedAt: evLoad.updatedAt,
    error: evLoad.error,
  });

  const ownerLoad = await loadOrRefresh({
    symbol,
    dataset: "owner_earnings",
    read: async () => {
      const { data, updatedAt, asOf } = await store.readMetrics(
        symbol,
        "owner_earnings",
      );
      if (store.isEmptyMarker(data)) {
        return {
          value: [] as JsonRow[],
          updatedAt: newestTimestamp(updatedAt, asOf),
        };
      }
      const rows = Array.isArray(data) ? data : data ? [data as JsonRow] : [];
      return {
        value: rows.filter((r) => r.__empty !== true),
        updatedAt: newestTimestamp(updatedAt, asOf),
      };
    },
    isEmpty: (v) => v.length === 0,
    fetchFmp: () => fmpFetchOwnerEarnings(symbol),
    write: async (rows) => {
      await store.writeMetrics({
        symbol,
        dataset: "owner_earnings",
        data: rows,
      });
    },
    writeEmpty: async () => {
      await store.writeEmptyMarker({ symbol, dataset: "owner_earnings" });
    },
  });
  status.push({
    dataset: "owner_earnings",
    source: ownerLoad.source,
    updatedAt: ownerLoad.updatedAt,
    error: ownerLoad.error,
  });

  const growthLoad = await loadOrRefresh({
    symbol,
    dataset: "growth",
    read: async () => {
      const { data, updatedAt, asOf } = await store.readMetrics(symbol, "growth");
      if (store.isEmptyMarker(data)) {
        return {
          value: [] as JsonRow[],
          updatedAt: newestTimestamp(updatedAt, asOf),
        };
      }
      const rows = Array.isArray(data) ? data : data ? [data as JsonRow] : [];
      return {
        value: rows.filter((r) => r.__empty !== true),
        updatedAt: newestTimestamp(updatedAt, asOf),
      };
    },
    isEmpty: (v) => v.length === 0,
    fetchFmp: async () => {
      const g = await fmpFetchGrowth(symbol);
      return [...g.incomeGrowth, ...g.financialGrowth];
    },
    write: async (rows) => {
      await store.writeMetrics({ symbol, dataset: "growth", data: rows });
    },
    writeEmpty: async () => {
      await store.writeEmptyMarker({ symbol, dataset: "growth" });
    },
  });
  status.push({
    dataset: "growth",
    source: growthLoad.source,
    updatedAt: growthLoad.updatedAt,
    error: growthLoad.error,
  });

  const estimatesLoad = await loadOrRefresh({
    symbol,
    dataset: "estimates",
    read: async () => {
      const { data, updatedAt, asOf } = await store.readMetrics(
        symbol,
        "estimates",
      );
      if (store.isEmptyMarker(data)) {
        return { value: [] as JsonRow[], updatedAt: newestTimestamp(updatedAt, asOf) };
      }
      const rows = Array.isArray(data) ? data : data ? [data as JsonRow] : [];
      return {
        value: rows.filter((r) => r.__empty !== true),
        updatedAt: newestTimestamp(updatedAt, asOf),
      };
    },
    isEmpty: (v) => v.length === 0,
    fetchFmp: () => fmpFetchEstimatesBundle(symbol),
    write: async (rows) => {
      await store.writeMetrics({ symbol, dataset: "estimates", data: rows });
    },
    writeEmpty: async () => {
      await store.writeEmptyMarker({ symbol, dataset: "estimates" });
    },
    emptyErrorToken: ESTIMATES_EMPTY_TOKEN,
  });
  status.push({
    dataset: "estimates",
    source: estimatesLoad.source,
    updatedAt: estimatesLoad.updatedAt,
    error: estimatesLoad.error,
  });

  const streetLoad = await loadOrRefresh({
    symbol,
    dataset: "street_consensus",
    read: async () => {
      // Stored under estimates / street_consensus period so older
      // company_metrics dataset checks still accept the row.
      const { data, updatedAt, asOf } = await store.readMetrics(
        symbol,
        "estimates",
        "street_consensus",
      );
      if (store.isEmptyMarker(data)) {
        return {
          value: null as JsonRow | null,
          updatedAt: newestTimestamp(updatedAt, asOf),
        };
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        value: (row as JsonRow) ?? null,
        updatedAt: newestTimestamp(updatedAt, asOf),
      };
    },
    isEmpty: (v) => v == null,
    fetchFmp: () => fmpFetchStreetConsensusBundle(symbol),
    write: async (row) => {
      if (!row) return;
      await store.writeMetrics({
        symbol,
        dataset: "estimates",
        periodType: "street_consensus",
        data: row,
      });
    },
    writeEmpty: async () => {
      await store.writeEmptyMarker({
        symbol,
        dataset: "estimates",
        periodType: "street_consensus",
      });
    },
    emptyErrorToken: STREET_CONSENSUS_EMPTY_TOKEN,
  });
  status.push({
    dataset: "street_consensus",
    source: streetLoad.source,
    updatedAt: streetLoad.updatedAt,
    error: streetLoad.error,
  });

  const dcfLoad = await loadOrRefresh({
    symbol,
    dataset: "dcf",
    read: async () => {
      const { data, updatedAt, asOf } = await store.readMetrics(symbol, "dcf");
      if (store.isEmptyMarker(data)) {
        return {
          value: null as JsonRow | null,
          updatedAt: newestTimestamp(updatedAt, asOf),
        };
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        value: (row as JsonRow) ?? null,
        updatedAt: newestTimestamp(updatedAt, asOf),
      };
    },
    isEmpty: (v) => v == null,
    fetchFmp: async () => (await fmpFetchDcf(symbol))[0] ?? null,
    write: async (row) => {
      if (!row) return;
      await store.writeMetrics({ symbol, dataset: "dcf", data: row });
    },
    writeEmpty: async () => {
      await store.writeEmptyMarker({ symbol, dataset: "dcf" });
    },
  });
  status.push({
    dataset: "dcf",
    source: dcfLoad.source,
    updatedAt: dcfLoad.updatedAt,
    error: dcfLoad.error,
  });

  const dailyLoad = await loadOrRefresh({
    symbol,
    dataset: "price_daily",
    read: async () => {
      const { bars, updatedAt } = await store.readPriceHistory(symbol, "daily");
      return { value: bars, updatedAt };
    },
    isEmpty: (v) => v.length === 0,
    fetchFmp: () => fmpFetchDailyHistory(symbol),
    write: async (bars) => {
      await store.writePriceHistory({ symbol, timeframe: "daily", bars });
    },
  });
  status.push({
    dataset: "price_daily",
    source: dailyLoad.source,
    updatedAt: dailyLoad.updatedAt,
    error: dailyLoad.error,
  });

  let hourlyBars: OhlcBar[] = [];
  if (includeHourly) {
    const hourlyLoad = await loadOrRefresh({
      symbol,
      dataset: "price_hourly",
      read: async () => {
        const { bars, updatedAt } = await store.readPriceHistory(
          symbol,
          "hourly",
        );
        return { value: bars, updatedAt };
      },
      isEmpty: (v) => v.length === 0,
      fetchFmp: () => fmpFetchHourlyHistory(symbol),
      write: async (bars) => {
        await store.writePriceHistory({ symbol, timeframe: "hourly", bars });
      },
    });
    hourlyBars = hourlyLoad.value;
    status.push({
      dataset: "price_hourly",
      source: hourlyLoad.source,
      updatedAt: hourlyLoad.updatedAt,
      error: hourlyLoad.error,
    });
  }

  const profile = profileLoad.value;
  const peersLoad = await loadPeers(
    symbol,
    profile?.industryKey ?? null,
    profile?.industry ?? null,
    profile?.sectorKey ?? null,
    profile?.sector ?? null,
  );
  status.push({
    dataset: "peers",
    source: peersLoad.source,
    updatedAt: peersLoad.updatedAt,
    error: peersLoad.error,
  });

  let recentEvents: AnalysisRecentEvent[] = [];
  try {
    const eventsLoad = await loadInvestorEvents(symbol, profile?.name ?? null);
    recentEvents = eventsLoad.value.events;
    status.push({
      dataset: "investor_events",
      source: eventsLoad.source,
      updatedAt: eventsLoad.updatedAt,
      error: eventsLoad.error,
    });
  } catch {
    status.push({
      dataset: "investor_events",
      source: "missing",
      updatedAt: null,
      error: "investor_events skipped",
    });
  }

  const marketCap =
    quoteLoad.value?.marketCap ?? profile?.marketCap ?? null;

  const fundamentalsRaw =
    profile != null
      ? buildFundamentalInputsFromPackage({
          profile: {
            marketCap,
            sector: profile.sector,
            sectorKey: profile.sectorKey,
            industry: profile.industry,
            industryKey: profile.industryKey,
          },
          price: quoteLoad.value?.price ?? null,
          ratiosTtm: ratiosTtmLoad.value,
          ratiosAnnual: ratiosAnnualLoad.value,
          keyMetricsTtm: kmTtm.value,
          keyMetricsAnnual: kmAnnual.value,
          incomeTtm: statements.income.ttm,
          incomeQuarter: statements.income.quarter,
          incomeAnnual: statements.income.annual,
          balanceTtm: statements.balance.ttm,
          balanceQuarter: statements.balance.quarter,
          balanceAnnual: statements.balance.annual,
          cashflowTtm: statements.cashflow.ttm,
          cashflowQuarter: statements.cashflow.quarter,
          cashflowAnnual: statements.cashflow.annual,
          scores: scoresLoad.value,
          estimates: estimatesLoad.value,
          enterpriseValues: evLoad.value,
          growth: growthLoad.value,
          ownerEarnings: ownerLoad.value,
        })
      : null;

  const resolved = fundamentalsRaw
    ? resolveFundamentalInputs(fundamentalsRaw)
    : null;
  const fundamentals = resolved?.inputs ?? null;

  const inc0 =
    statements.income.ttm[0] ??
    statements.income.annual[0] ??
    statements.income.quarter[0] ??
    null;
  const estimateOutlook = buildEstimateOutlook(estimatesLoad.value, {
    price: quoteLoad.value?.price ?? null,
    trailingRevenue:
      num(inc0?.revenue) ?? fundamentals?.totalRevenue ?? null,
    trailingEps: num(inc0?.epsdiluted) ?? num(inc0?.eps),
  });
  const forecast = buildAnalysisForecast({
    street: streetLoad.value,
    estimateOutlook,
  });

  let ath = 0;
  for (const bar of dailyLoad.value) {
    if (bar.high > ath) ath = bar.high;
  }

  const degraded = status.some((s) => s.source === "stale");
  const missingCritical =
    !quoteLoad.value?.price ||
    (!statements.income.annual.length &&
      !statements.income.quarter.length &&
      !statements.income.ttm.length);

  const confNotes = [
    ...(resolved ? formatSubstitutionNotes(resolved) : []),
  ];
  if (degraded) {
    confNotes.unshift(
      "Serving stale warehouse data — FMP refresh failed or rate-limited.",
    );
  } else if (missingCritical) {
    confNotes.unshift(
      "Incomplete fundamentals package — some rating inputs unavailable.",
    );
  }

  if (process.env.NODE_ENV === "development") {
    const summary = {
      fromFmp: status.filter((s) => s.source === "fmp").length,
      fromCache: status.filter((s) => s.source === "supabase").length,
      stale: status.filter((s) => s.source === "stale").length,
      missing: status.filter((s) => s.source === "missing").length,
    };
    console.info(`[warehouse] ${symbol} package summary`, summary);
  }

  return {
    symbol,
    assetType: "stock",
    asOf: new Date().toISOString(),
    degraded: degraded || missingCritical,
    confidenceNote: confNotes.length ? confNotes.join(" ") : null,
    quote: quoteLoad.value,
    profile: profile
      ? {
          name: profile.name,
          sector: profile.sector,
          sectorKey: profile.sectorKey,
          industry: profile.industry,
          industryKey: profile.industryKey,
          country: profile.country,
          exchange: profile.exchange,
          currency: profile.currency,
          description: profile.description,
          marketCap,
          isEtf: profile.isEtf ?? null,
          isFund: profile.isFund ?? null,
          raw: profile.raw ?? null,
        }
      : null,
    statements,
    ratiosTtm: ratiosTtmLoad.value,
    ratiosAnnual: ratiosAnnualLoad.value,
    keyMetricsTtm: kmTtm.value,
    keyMetricsAnnual: kmAnnual.value,
    financialScores: scoresLoad.value,
    enterpriseValues: evLoad.value,
    ownerEarnings: ownerLoad.value,
    growth: growthLoad.value,
    estimates: estimatesLoad.value,
    estimateOutlook,
    forecast,
    dcf: dcfLoad.value,
    peers: peersLoad.value.peers,
    peerContext: peersLoad.value.context,
    dailyBars: dailyLoad.value,
    hourlyBars,
    ath: ath > 0 ? ath : null,
    fundamentals,
    recentEvents,
    datasetStatus: status,
  };
}

export function packageNetworkSummary(pkg: AnalysisPackage): {
  fromFmp: number;
  fromCache: number;
  stale: number;
  missing: number;
} {
  let fromFmp = 0;
  let fromCache = 0;
  let stale = 0;
  let missing = 0;
  for (const s of pkg.datasetStatus) {
    if (s.source === "fmp") fromFmp += 1;
    else if (s.source === "supabase") fromCache += 1;
    else if (s.source === "stale") stale += 1;
    else missing += 1;
  }
  return { fromFmp, fromCache, stale, missing };
}
