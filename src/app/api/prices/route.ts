import { NextResponse } from "next/server";
import { fetchAssetPrices } from "@/lib/portfolio/prices";
import type { PriceRequestAsset } from "@/types/portfolio";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { assets?: PriceRequestAsset[] };

    if (!body.assets?.length) {
      return NextResponse.json(
        { error: "No assets provided" },
        { status: 400 },
      );
    }

    const result = await fetchAssetPrices(body.assets);

    return NextResponse.json({
      prices: result.prices,
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
