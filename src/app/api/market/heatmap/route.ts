export const revalidate = 60;

import { NextResponse } from "next/server";
import { isFmpDisplayGateEnabled } from "@/lib/market-data/display-gate";
import { fmpDisplayDeniedResponse } from "@/lib/market-data/display-gate-server";
import { fetchIndexHeatmap } from "@/lib/market/fetch-heatmap";
import { parseMarketIndex } from "@/lib/market/index-config";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimitJsonResponse(request, "heatmap", { max: 40 });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const index = parseMarketIndex(searchParams.get("index"));
  const gateOn = isFmpDisplayGateEnabled();

  try {
    if (gateOn) {
      const denied = await fmpDisplayDeniedResponse({
        index,
        stocks: [],
        gainers: [],
        losers: [],
        fetchedAt: new Date().toISOString(),
        totalConstituents: 0,
        displayedCount: 0,
      });
      if (denied) return denied;
    }

    const result = await fetchIndexHeatmap(index);

    const response = NextResponse.json({
      ...result,
      fetchedAt: new Date().toISOString(),
    });
    if (gateOn) {
      response.headers.set("Cache-Control", "private, no-store");
    }
    return response;
  } catch (error) {
    console.error("Heatmap fetch error:", error);
    return NextResponse.json(
      { error: `Failed to fetch ${index} heatmap data` },
      { status: 500 },
    );
  }
}
