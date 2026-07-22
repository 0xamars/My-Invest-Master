import { NextResponse } from "next/server";
import { fetchSp500Heatmap } from "@/lib/market/fetch-heatmap";

export async function GET() {
  try {
    const stocks = await fetchSp500Heatmap();

    return NextResponse.json({
      stocks,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Heatmap fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch S&P 500 heatmap data" },
      { status: 500 },
    );
  }
}
