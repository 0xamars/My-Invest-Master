import { NextResponse } from "next/server";
import { fetchAnalysisQuote } from "@/lib/analysis/quote";
import { parseAnalysisAssetType } from "@/lib/analysis/types";

export async function GET(request: Request) {
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
