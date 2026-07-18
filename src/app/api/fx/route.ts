import { NextResponse } from "next/server";
import { fetchFxRates } from "@/lib/portfolio/prices/fx";

export async function GET() {
  try {
    const rates = await fetchFxRates();
    return NextResponse.json(rates);
  } catch (error) {
    console.error("FX rate error:", error);
    return NextResponse.json(
      { error: "Failed to fetch FX rates" },
      { status: 500 },
    );
  }
}
