export const revalidate = 60;

import { NextResponse } from "next/server";
import { fetchIndexHeatmap } from "@/lib/market/fetch-heatmap";
import { parseMarketIndex } from "@/lib/market/index-config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const index = parseMarketIndex(searchParams.get("index"));

  try {
    const result = await fetchIndexHeatmap(index);

    return NextResponse.json({
      ...result,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Heatmap fetch error:", error);
    return NextResponse.json(
      { error: `Failed to fetch ${index} heatmap data` },
      { status: 500 },
    );
  }
}
