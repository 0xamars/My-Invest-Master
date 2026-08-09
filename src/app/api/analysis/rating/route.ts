import { NextResponse } from "next/server";
import {
  chartPointsFromBars,
  fetchAnalysisHistory,
  fetchTechnicalSeries,
} from "@/lib/analysis/history";
import { buildInvestSalsaRating } from "@/lib/analysis/rating";
import { fetchAnalysisQuote } from "@/lib/analysis/quote";
import {
  parseAnalysisAssetType,
  type AnalysisChartRange,
} from "@/lib/analysis/types";
import {
  isFmpRateLimited,
  runWithFmpCallScope,
  type FmpCallStats,
} from "@/lib/market-data/fmp/client";
import { EMPTY_ESTIMATE_OUTLOOK } from "@/lib/analysis/street-outlook";
import {
  getAnalysisPackage,
  packageNetworkSummary,
} from "@/lib/market-data/warehouse";

const RANGES = new Set(["1D", "1W", "1M", "3M", "1Y", "5Y"]);

type RatingCacheEntry = {
  expiresAt: number;
  body: Record<string, unknown>;
};
const ratingResponseCache = new Map<string, RatingCacheEntry>();
const RATING_CACHE_TTL_MS = 45_000;

function ratingCacheKey(
  symbol: string,
  type: string,
  range: string,
  priceId?: string,
): string {
  return `${type}:${symbol.toUpperCase()}:${range}:${priceId ?? ""}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim() ?? "";
    const type = parseAnalysisAssetType(searchParams.get("type"));
    const priceId = searchParams.get("priceId") ?? undefined;
    const name = searchParams.get("name") ?? undefined;
    const rangeParam = searchParams.get("range") ?? "1M";
    const range = (
      RANGES.has(rangeParam) ? rangeParam : "1M"
    ) as AnalysisChartRange;
    const chartOnly = searchParams.get("chartOnly") === "1";
    const includeHourly = searchParams.get("skipHourly") !== "1";
    const forceRefresh = searchParams.get("refresh") === "1";

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 },
      );
    }

    if (chartOnly) {
      // Prefer warehouse daily/hourly when available via package for stocks
      if (type === "stock") {
        const pkg = await getAnalysisPackage(symbol, {
          includeHourly: range === "1D" || range === "1W",
        });
        const bars =
          range === "1D" || range === "1W"
            ? pkg.hourlyBars.length
              ? pkg.hourlyBars
              : pkg.dailyBars
            : pkg.dailyBars;
        if (bars.length > 0) {
          return NextResponse.json({
            chart: { range, points: chartPointsFromBars(bars, range) },
          });
        }
      }
      const chart = await fetchAnalysisHistory({ symbol, type, range });
      return NextResponse.json({
        chart: { range, points: chart },
      });
    }

    const cacheKey = ratingCacheKey(symbol, type, range, priceId);
    const warm = !forceRefresh ? ratingResponseCache.get(cacheKey) : undefined;
    if (warm && warm.expiresAt > Date.now()) {
      const body = warm.body;
      const prevMeta = (body.meta as Record<string, unknown> | undefined) ?? {};
      return NextResponse.json({
        ...body,
        meta: {
          ...prevMeta,
          cache: "warm",
          fmpRateLimited: isFmpRateLimited(),
        },
      });
    }

    const { result, stats } = await runWithFmpCallScope(
      `analysis:${symbol.toUpperCase()}`,
      async () => {
        // —— Stocks: FMP Analysis Package (Supabase warehouse) ——
        if (type === "stock") {
          const pkg = await getAnalysisPackage(symbol, { includeHourly });

          const quote =
            pkg.quote ??
            (await fetchAnalysisQuote({ symbol, type, priceId, name }));

          if (pkg.quote && name && !pkg.quote.name) {
            quote.name = name;
          }
          if (pkg.profile?.description && !quote.description) {
            quote.description = pkg.profile.description;
          }

          const price = quote.price;
          const athCandidates = [pkg.ath, quote.week52High, price].filter(
            (v): v is number => v != null && v > 0,
          );
          const ath =
            athCandidates.length > 0 ? Math.max(...athCandidates) : null;

          const rating = buildInvestSalsaRating({
            assetType: "stock",
            price,
            ath,
            fundamentals: pkg.fundamentals,
            peers: pkg.peers,
            peerContext: pkg.peerContext,
            dailyBars: pkg.dailyBars,
            hourlyBars: pkg.hourlyBars,
            symbol: symbol.toUpperCase(),
            vehicleProfile: pkg.profile
              ? {
                  name: pkg.profile.name,
                  industry: pkg.profile.industry,
                  industryKey: pkg.profile.industryKey,
                  sector: pkg.profile.sector,
                  sectorKey: pkg.profile.sectorKey,
                  description: pkg.profile.description,
                  exchange: pkg.profile.exchange,
                  isEtf: pkg.profile.isEtf,
                  isFund: pkg.profile.isFund,
                  raw: pkg.profile.raw,
                }
              : null,
          });

          const chartBars =
            range === "1D" || range === "1W"
              ? pkg.hourlyBars.length > 0
                ? pkg.hourlyBars
                : pkg.dailyBars
              : pkg.dailyBars;

          const warehouse = packageNetworkSummary(pkg);

          return {
            quote,
            rating,
            estimateOutlook: pkg.estimateOutlook ?? EMPTY_ESTIMATE_OUTLOOK,
            chart: {
              range,
              points: chartPointsFromBars(chartBars, range),
            },
            meta: {
              yahooSymbol: symbol.toUpperCase(),
              ath,
              dailyBars: pkg.dailyBars.length,
              hourlyBars: pkg.hourlyBars.length,
              peerBasis: rating.fundamental.peerContext.basis,
              peerCount: rating.fundamental.peerContext.peerCount,
              businessModel: rating.fundamental.classification.businessModel,
              cache: "cold" as const,
              fmpRateLimited: isFmpRateLimited(),
              warehouse,
              packageDegraded: pkg.degraded,
              packageConfidenceNote: pkg.confidenceNote,
              datasetStatus: pkg.datasetStatus,
              dataSource: "fmp-warehouse" as const,
            },
          };
        }

        // —— Crypto: unchanged (CoinGecko / Yahoo chart path) ——
        const [quote, techSeries] = await Promise.all([
          fetchAnalysisQuote({ symbol, type, priceId, name }),
          fetchTechnicalSeries({ symbol, type, includeHourly }),
        ]);

        const price = quote.price;
        const athCandidates = [
          techSeries.ath,
          quote.week52High,
          price,
        ].filter((v): v is number => v != null && v > 0);
        const ath =
          athCandidates.length > 0 ? Math.max(...athCandidates) : null;

        const rating = buildInvestSalsaRating({
          assetType: "crypto",
          price,
          ath,
          fundamentals: null,
          dailyBars: techSeries.dailyBars,
          hourlyBars: techSeries.hourlyBars,
        });

        const chartBars =
          range === "1D" || range === "1W"
            ? techSeries.hourlyBars.length > 0
              ? techSeries.hourlyBars
              : techSeries.dailyBars
            : techSeries.dailyBars;

        return {
          quote,
          rating,
          estimateOutlook: EMPTY_ESTIMATE_OUTLOOK,
          chart: {
            range,
            points: chartPointsFromBars(chartBars, range),
          },
          meta: {
            yahooSymbol: techSeries.yahooSymbol,
            ath,
            dailyBars: techSeries.dailyBars.length,
            hourlyBars: techSeries.hourlyBars.length,
            peerBasis: rating.fundamental.peerContext.basis,
            peerCount: rating.fundamental.peerContext.peerCount,
            businessModel: rating.fundamental.classification.businessModel,
            cache: "cold" as const,
            fmpRateLimited: isFmpRateLimited(),
            dataSource: "crypto" as const,
          },
        };
      },
    );

    const warehouse = (result.meta as { warehouse?: {
      fromFmp: number;
      fromCache: number;
      stale: number;
      missing: number;
    } }).warehouse;

    const body = {
      ...result,
      meta: {
        ...result.meta,
        fmp: summarizeFmpStats(stats, warehouse),
      },
    };

    if (process.env.NODE_ENV === "development" && warehouse) {
      console.info(
        `[Analysis] ${symbol.toUpperCase()} warehouse cacheHits=${warehouse.fromCache} network=${warehouse.fromFmp} stale=${warehouse.stale} missing=${warehouse.missing} (fmpMemory network=${stats.networkCalls})`,
      );
    }

    ratingResponseCache.set(cacheKey, {
      body,
      expiresAt: Date.now() + RATING_CACHE_TTL_MS,
    });
    if (ratingResponseCache.size > 80) {
      const first = ratingResponseCache.keys().next().value;
      if (first) ratingResponseCache.delete(first);
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("Analysis rating error:", error);
    return NextResponse.json(
      {
        error: "Failed to compute InvestSalsa Rating",
        fmpRateLimited: isFmpRateLimited(),
      },
      { status: 500 },
    );
  }
}

function summarizeFmpStats(
  stats: FmpCallStats,
  warehouse?: {
    fromFmp: number;
    fromCache: number;
    stale: number;
    missing: number;
  },
) {
  return {
    // Prefer warehouse dataset accounting — this is the real Supabase hit rate
    networkCalls: warehouse?.fromFmp ?? stats.networkCalls,
    cacheHits: warehouse?.fromCache ?? stats.cacheHits,
    coalesced: stats.coalesced,
    byCategory: stats.byCategory,
    fmpMemory: {
      networkCalls: stats.networkCalls,
      cacheHits: stats.cacheHits,
    },
    warehouse: warehouse ?? null,
  };
}
