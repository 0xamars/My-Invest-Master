import { NextResponse } from "next/server";
import {
  fetchMarketNews,
  fetchNewsForSymbols,
} from "@/lib/market/fetch-news";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimitJsonResponse(request, "news", { max: 40 });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams
      .get("symbols")
      ?.split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 8);

    if (symbols && symbols.length > 0) {
      const items = await fetchNewsForSymbols(symbols);
      return NextResponse.json({
        stockNews: items,
        cryptoNews: [],
        fetchedAt: new Date().toISOString(),
      });
    }

    const { stockNews, cryptoNews } = await fetchMarketNews();

    return NextResponse.json({
      stockNews,
      cryptoNews,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("News fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch market news" },
      { status: 500 },
    );
  }
}
