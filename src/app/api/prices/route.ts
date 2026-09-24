import { NextResponse } from "next/server";
import { fmpDisplayDeniedResponse } from "@/lib/market-data/display-gate-server";
import { fetchAssetPrices } from "@/lib/portfolio/prices";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";
import type { PriceRequestAsset } from "@/types/portfolio";

export async function POST(request: Request) {
  const limited = rateLimitJsonResponse(request, "prices", { max: 60 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as { assets?: PriceRequestAsset[] };

    if (!body.assets?.length) {
      return NextResponse.json(
        { error: "No assets provided" },
        { status: 400 },
      );
    }

    const asksForLivePrice = body.assets.some(
      (asset) => asset?.type === "stock" || asset?.type === "crypto",
    );
    if (asksForLivePrice) {
      const denied = await fmpDisplayDeniedResponse({
        prices: {},
        changes: {},
        errors: {},
        fetchedAt: new Date().toISOString(),
      });
      if (denied) return denied;
    }

    const result = await fetchAssetPrices(body.assets);

    return NextResponse.json({
      prices: result.prices,
      changes: result.changes,
      errors: result.errors,
      fetchedAt: result.fetchedAt,
    });
  } catch (error) {
    console.error("Price fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 500 },
    );
  }
}
