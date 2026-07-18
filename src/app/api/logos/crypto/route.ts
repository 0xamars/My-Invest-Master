import { NextResponse } from "next/server";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const priceId = searchParams.get("priceId")?.trim();

  if (!priceId) {
    return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${COINGECKO_BASE}/coins/${encodeURIComponent(priceId)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
      {
        next: { revalidate: 86400 },
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      return NextResponse.json({ logoUrl: null });
    }

    const data = (await response.json()) as {
      image?: { thumb?: string; small?: string; large?: string };
    };

    const logoUrl =
      data.image?.thumb ?? data.image?.small ?? data.image?.large ?? null;

    return NextResponse.json({ logoUrl });
  } catch (error) {
    console.error("Crypto logo fetch error:", error);
    return NextResponse.json({ logoUrl: null });
  }
}
