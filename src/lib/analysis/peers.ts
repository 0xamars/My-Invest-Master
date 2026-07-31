import {
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
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function fetchPeerRow(symbol: string): Promise<PeerMetricRow | null> {
  try {
    const result = await yahooFinance.quoteSummary(symbol.toUpperCase(), {
      modules: [
        "financialData",
        "defaultKeyStatistics",
        "summaryDetail",
        "assetProfile",
      ],
    });
    const fd = (result.financialData ?? {}) as Record<string, unknown>;
    const ks = (result.defaultKeyStatistics ?? {}) as Record<string, unknown>;
    const sd = (result.summaryDetail ?? {}) as Record<string, unknown>;
    const ap = (result.assetProfile ?? {}) as Record<string, unknown>;
    const freeCashflow = num(fd.freeCashflow);
    const marketCap = num(sd.marketCap) ?? num(ks.marketCap);
    const priceToFcf =
      freeCashflow != null &&
      freeCashflow > 0 &&
      marketCap != null &&
      marketCap > 0
        ? marketCap / freeCashflow
        : null;

    return {
      symbol: symbol.toUpperCase(),
      industryKey: str(ap.industryKey),
      sectorKey: str(ap.sectorKey),
      debtToEquity: num(fd.debtToEquity),
      currentRatio: num(fd.currentRatio),
      operatingMargins: num(fd.operatingMargins),
      profitMargins: num(fd.profitMargins) ?? num(ks.profitMargins),
      grossMargins: num(fd.grossMargins),
      returnOnEquity: num(fd.returnOnEquity),
      returnOnAssets: num(fd.returnOnAssets),
      revenueGrowth: num(fd.revenueGrowth),
      earningsGrowth: num(fd.earningsGrowth),
      trailingPE: num(sd.trailingPE) ?? num(ks.trailingPE),
      enterpriseToEbitda: num(ks.enterpriseToEbitda),
      priceToSales:
        num(sd.priceToSalesTrailing12Months) ??
        num(ks.priceToSalesTrailing12Months),
      priceToFcf,
      pegRatio: num(ks.pegRatio),
    };
  } catch {
    return null;
  }
}

async function recommendedSymbols(symbol: string): Promise<string[]> {
  try {
    const rec = await yahooFinance.recommendationsBySymbol(symbol.toUpperCase());
    const list = (
      rec as { recommendedSymbols?: Array<{ symbol?: string }> }
    ).recommendedSymbols;
    if (!Array.isArray(list)) return [];
    return list
      .map((r) => r.symbol?.toUpperCase())
      .filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}

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

export type PeerBundle = {
  context: FundamentalPeerContext;
  peers: PeerMetricRow[];
};

/**
 * Build granular peer context: sub-industry → industry group → sector → none.
 * Never silently pretends sector peers are granular.
 */
export async function fetchPeerBundle(input: {
  symbol: string;
  industryKey: string | null;
  industry: string | null;
  sectorKey: string | null;
  sector: string | null;
}): Promise<PeerBundle> {
  const self = input.symbol.toUpperCase();
  const industryKey = input.industryKey;
  const sectorKey = input.sectorKey;

  const recs = await recommendedSymbols(self);
  const recList = Array.isArray(recs) ? recs : [];

  async function loadFiltered(
    candidates: string[],
    filter: (row: PeerMetricRow) => boolean,
    basis: PeerBasis,
    labelBase: string,
  ): Promise<PeerBundle | null> {
    const symbols = uniqueSymbols(candidates, self).slice(0, MAX_PEERS_FETCH);
    if (symbols.length === 0) return null;
    const rows = (
      await Promise.all(symbols.map((s) => fetchPeerRow(s)))
    ).filter((r): r is PeerMetricRow => r != null && filter(r));

    if (rows.length < MIN_PEER_COUNT) return null;
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

  // 1) Same industryKey (sub-industry)
  if (industryKey) {
    const seeds = INDUSTRY_PEER_SEEDS[industryKey] ?? [];
    const sub = await loadFiltered(
      [...seeds, ...recList],
      (row) => row.industryKey === industryKey,
      "sub_industry",
      input.industry ?? industryKey,
    );
    if (sub) return sub;

    // 2) Industry group aliases
    const aliases = INDUSTRY_GROUP_ALIASES[industryKey] ?? [industryKey];
    const groupSeeds = aliases.flatMap((k) => INDUSTRY_PEER_SEEDS[k] ?? []);
    const industry = await loadFiltered(
      [...groupSeeds, ...recList],
      (row) =>
        row.industryKey != null && aliases.includes(row.industryKey),
      "industry",
      `${input.industry ?? industryKey} group`,
    );
    if (industry) return industry;
  }

  // 3) Broad sector fallback
  if (sectorKey) {
    const seeds = SECTOR_PEER_SEEDS[sectorKey] ?? [];
    const sector = await loadFiltered(
      [...seeds, ...recList],
      (row) => row.sectorKey === sectorKey,
      "sector",
      `${input.sector ?? sectorKey} (broad sector)`,
    );
    if (sector) return sector;
  }

  return {
    context: {
      basis: "none",
      label: "No peer set (absolute thresholds)",
      peerCount: 0,
      industryKey,
      industry: input.industry,
      sectorKey,
      sector: input.sector,
    },
    peers: [],
  };
}
