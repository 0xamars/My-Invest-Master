import { NextResponse } from "next/server";
import { fetchStockFundamentals } from "@/lib/analysis/fundamentals-data";
import {
  fetchAnalysisHistory,
  fetchTechnicalSeries,
} from "@/lib/analysis/history";
import { fetchPeerBundle } from "@/lib/analysis/peers";
import { buildInvestSalsaRating } from "@/lib/analysis/rating";
import { fetchAnalysisQuote } from "@/lib/analysis/quote";
import {
  parseAnalysisAssetType,
  type AnalysisChartRange,
} from "@/lib/analysis/types";

const RANGES = new Set(["1D", "1W", "1M", "3M", "1Y", "5Y"]);

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

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 },
      );
    }

    if (chartOnly) {
      const chart = await fetchAnalysisHistory({ symbol, type, range });
      return NextResponse.json({
        chart: { range, points: chart },
      });
    }

    const [quote, techSeries, fundamentals] = await Promise.all([
      fetchAnalysisQuote({ symbol, type, priceId, name }),
      fetchTechnicalSeries({ symbol, type }),
      type === "stock" ? fetchStockFundamentals(symbol) : Promise.resolve(null),
    ]);

    const peerBundle =
      type === "stock" && fundamentals
        ? await fetchPeerBundle({
            symbol,
            industryKey: fundamentals.industryKey,
            industry: fundamentals.industry,
            sectorKey: fundamentals.sectorKey,
            sector: fundamentals.sector,
          })
        : null;

    const price = quote.price;
    const athCandidates = [
      techSeries.ath,
      quote.week52High,
      price,
    ].filter((v): v is number => v != null && v > 0);
    const ath =
      athCandidates.length > 0 ? Math.max(...athCandidates) : null;

    const rating = buildInvestSalsaRating({
      assetType: type,
      price,
      ath,
      fundamentals,
      peers: peerBundle?.peers,
      peerContext: peerBundle?.context,
      dailyBars: techSeries.dailyBars,
      hourlyBars: techSeries.hourlyBars,
    });

    const chart = await fetchAnalysisHistory({
      symbol,
      type,
      range,
    });

    return NextResponse.json({
      quote,
      rating,
      chart: {
        range,
        points: chart,
      },
      meta: {
        yahooSymbol: techSeries.yahooSymbol,
        ath,
        dailyBars: techSeries.dailyBars.length,
        hourlyBars: techSeries.hourlyBars.length,
        peerBasis: rating.fundamental.peerContext.basis,
        peerCount: rating.fundamental.peerContext.peerCount,
        businessModel: rating.fundamental.classification.businessModel,
      },
    });
  } catch (error) {
    console.error("Analysis rating error:", error);
    return NextResponse.json(
      { error: "Failed to compute InvestSalsa Rating" },
      { status: 500 },
    );
  }
}
