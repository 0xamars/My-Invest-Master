import { NextResponse } from "next/server";
import { searchAssets } from "@/lib/portfolio/search";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";
import type { AssetType } from "@/types/portfolio";

export async function GET(request: Request) {
  const limited = rateLimitJsonResponse(request, "asset-search", { max: 60 });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const type = (searchParams.get("type") ?? "stock") as AssetType;

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  if (type !== "stock" && type !== "crypto") {
    return NextResponse.json({ error: "Invalid asset type" }, { status: 400 });
  }

  try {
    const results = await searchAssets(query, type);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Asset search error:", error);
    return NextResponse.json(
      { error: "Failed to search assets" },
      { status: 500 },
    );
  }
}
