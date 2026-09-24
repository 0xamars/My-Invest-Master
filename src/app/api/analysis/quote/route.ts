import { NextResponse } from "next/server";
import { fetchAnalysisQuote } from "@/lib/analysis/quote";
import { parseAnalysisAssetType } from "@/lib/analysis/types";
import { fmpDisplayDeniedResponse } from "@/lib/market-data/display-gate-server";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimitJsonResponse(request, "analysis-quote", { max: 40 });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim() ?? "";
    const type = parseAnalysisAssetType(searchParams.get("type"));
    const priceId = searchParams.get("priceId") ?? undefined;
    const name = searchParams.get("name") ?? undefined;

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 },
      );
    }

    const denied = await fmpDisplayDeniedResponse({
      symbol: symbol.toUpperCase(),
      name: name?.trim() || symbol.toUpperCase(),
      type,
      priceId,
      price: null,
      change: null,
      changePercent: null,
      marketCap: null,
      volume: null,
      averageVolume: null,
      dayLow: null,
      dayHigh: null,
      week52Low: null,
      week52High: null,
      currency: "USD",
      fetchedAt: new Date().toISOString(),
    });
    if (denied) return denied;

    const quote = await fetchAnalysisQuote({
      symbol,
      type,
      priceId,
      name,
    });

    return NextResponse.json(quote);
  } catch (error) {
    console.error("Analysis quote error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis quote" },
      { status: 500 },
    );
  }
}
