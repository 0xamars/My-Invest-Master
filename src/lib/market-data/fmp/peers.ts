import { fmpFetch, isFmpRateLimited, num } from "@/lib/market-data/fmp/client";
import {
  ACCEPT_PEER_COUNT,
  INDUSTRY_GROUP_ALIASES,
  INDUSTRY_PEER_SEEDS,
  MAX_PEERS_FETCH,
  MIN_PEER_COUNT,
  SECTOR_PEER_SEEDS,
} from "@/lib/analysis/rating/peer-universe";
import type {
  FundamentalPeerContext,
  PeerBasis,
  PeerMetricRow,
} from "@/lib/analysis/rating/types";
import { toIndustryKey } from "@/lib/market-data/industry-overrides";

type Row = Record<string, unknown>;

type BundleCacheEntry = {
  expiresAt: number;
  bundle: PeerBundle;
};

/** Aggressive in-process peer-bundle cache (industry set changes slowly). */
const peerBundleCache = new Map<string, BundleCacheEntry>();
const PEER_BUNDLE_TTL_MS = 60 * 60_000;

function uniqueSymbols(symbols: string[], self: string): string[] {
  const upper = self.toUpperCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of symbols) {
    const u = s.toUpperCase();
    if (!u || u === upper || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function pickNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}

/**
 * Lightweight peer row: ratios-ttm only (1 call).
 * Seeded peers pass assumed industry/sector keys so we skip /profile.
 */
async function fetchPeerRow(
  symbol: string,
  assumed?: {
    industryKey: string | null;
    sectorKey: string | null;
  },
): Promise<PeerMetricRow | null> {
  const upper = symbol.toUpperCase();
  if (isFmpRateLimited()) return null;
  try {
    const ratios = await fmpFetch<Row[]>({
      path: "/ratios-ttm",
      query: { symbol: upper },
      revalidate: 3600,
    }).catch(() => []);
    const r = Array.isArray(ratios) ? ratios[0] : null;
    if (!r) return null;

    let debtToEquity = pickNum(
      r.debtEquityRatioTTM,
      r.debtToEquityTTM,
      r.debtEquityRatio,
      r.debtToEquity,
    );
    if (debtToEquity != null && Math.abs(debtToEquity) < 5) {
      debtToEquity *= 100;
    }

    return {
      symbol: upper,
      industryKey: assumed?.industryKey ?? null,
      sectorKey: assumed?.sectorKey ?? null,
      debtToEquity,
      currentRatio: pickNum(r.currentRatioTTM, r.currentRatio),
      operatingMargins: pickNum(
        r.operatingProfitMarginTTM,
        r.operatingProfitMargin,
      ),
      profitMargins: pickNum(r.netProfitMarginTTM, r.netProfitMargin),
      grossMargins: pickNum(r.grossProfitMarginTTM, r.grossProfitMargin),
      returnOnEquity: pickNum(r.returnOnEquityTTM, r.returnOnEquity),
      returnOnAssets: pickNum(r.returnOnAssetsTTM, r.returnOnAssets),
      returnOnInvestedCapital: pickNum(
        r.returnOnCapitalEmployedTTM,
        r.returnOnCapitalEmployed,
        r.roicTTM,
        r.roic,
      ),
      revenueGrowth: null,
      earningsGrowth: null,
      trailingPE: pickNum(
        r.peRatioTTM,
        r.priceEarningsRatioTTM,
        r.peRatio,
        r.priceEarningsRatio,
      ),
      enterpriseToEbitda: pickNum(
        r.enterpriseValueMultipleTTM,
        r.enterpriseValueMultiple,
        r.evToEBITDATTM,
        r.evToEBITDA,
      ),
      priceToSales: pickNum(r.priceToSalesRatioTTM, r.priceToSalesRatio),
      priceToFcf: pickNum(
        r.priceToFreeCashFlowsRatioTTM,
        r.priceToFreeCashFlowsRatio,
      ),
      pegRatio: pickNum(r.pegRatioTTM, r.pegRatio),
    };
  } catch {
    return null;
  }
}

/** Fetch peers in small batches to reduce burst 429s. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    if (isFmpRateLimited()) break;
    const chunk = items.slice(i, i + concurrency);
    const rows = await Promise.all(chunk.map(fn));
    out.push(...rows);
  }
  return out;
}

export type PeerBundle = {
  context: FundamentalPeerContext;
  peers: PeerMetricRow[];
};

export async function fetchFmpPeerBundle(input: {
  symbol: string;
  industryKey: string | null;
  industry: string | null;
  sectorKey: string | null;
  sector: string | null;
}): Promise<PeerBundle> {
  const self = input.symbol.toUpperCase();
  const industryKey = input.industryKey ?? toIndustryKey(input.industry);
  const sectorKey = input.sectorKey ?? toIndustryKey(input.sector);

  const cacheKey = `${self}|${industryKey ?? ""}|${sectorKey ?? ""}`;
  const cached = peerBundleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.bundle;
  }

  const empty = (): PeerBundle => ({
    context: {
      basis: "none",
      label: isFmpRateLimited()
        ? "No peer set (FMP rate limited)"
        : "No peer set (absolute thresholds)",
      peerCount: 0,
      industryKey,
      industry: input.industry,
      sectorKey,
      sector: input.sector,
    },
    peers: [],
  });

  if (isFmpRateLimited()) return empty();

  /** Symbols already fetched this bundle — prevent cascade re-fetch. */
  const fetched = new Set<string>();

  async function loadSeeds(
    candidates: string[],
    basis: PeerBasis,
    labelBase: string,
    assumedIndustry: string | null,
    assumedSector: string | null,
    minAccept: number,
  ): Promise<PeerBundle | null> {
    if (isFmpRateLimited()) return null;

    const symbols = uniqueSymbols(candidates, self)
      .filter((s) => !fetched.has(s))
      .slice(0, MAX_PEERS_FETCH);
    if (symbols.length === 0) return null;

    for (const s of symbols) fetched.add(s);

    const rows = (
      await mapPool(symbols, 3, (s) =>
        fetchPeerRow(s, {
          industryKey: assumedIndustry,
          sectorKey: assumedSector,
        }),
      )
    ).filter((r): r is PeerMetricRow => r != null);

    if (rows.length < minAccept) return null;
    return {
      context: {
        basis,
        label: `${labelBase} · ${rows.length} peers`,
        peerCount: rows.length,
        industryKey,
        industry: input.industry,
        sectorKey,
        sector: input.sector,
      },
      peers: rows,
    };
  }

  let result: PeerBundle | null = null;

  // Prefer curated seeds first (1 call/peer) — never fan out full statement packs.
  if (industryKey) {
    const seeds = INDUSTRY_PEER_SEEDS[industryKey] ?? [];
    result = await loadSeeds(
      seeds,
      "sub_industry",
      input.industry ?? industryKey,
      industryKey,
      sectorKey,
      ACCEPT_PEER_COUNT,
    );

    // Only cascade when first tier is empty/thin AND we are not rate-limited.
    if (!result && !isFmpRateLimited()) {
      const aliases = INDUSTRY_GROUP_ALIASES[industryKey] ?? [industryKey];
      const groupSeeds = aliases.flatMap((k) => INDUSTRY_PEER_SEEDS[k] ?? []);
      result = await loadSeeds(
        groupSeeds,
        "industry",
        `${input.industry ?? industryKey} group`,
        industryKey,
        sectorKey,
        MIN_PEER_COUNT,
      );
    }
  }

  if (!result && sectorKey && !isFmpRateLimited()) {
    const seeds = SECTOR_PEER_SEEDS[sectorKey] ?? [];
    result = await loadSeeds(
      seeds,
      "sector",
      `${input.sector ?? sectorKey} (broad sector)`,
      industryKey,
      sectorKey,
      MIN_PEER_COUNT,
    );
  }

  const bundle = result ?? empty();
  peerBundleCache.set(cacheKey, {
    bundle,
    expiresAt: Date.now() + PEER_BUNDLE_TTL_MS,
  });
  return bundle;
}
