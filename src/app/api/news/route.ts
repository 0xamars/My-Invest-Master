import { NextResponse } from "next/server";
import { fetchMarketNews } from "@/lib/market/fetch-news";

export async function GET() {
  try {
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
