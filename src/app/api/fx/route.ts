import { NextResponse } from "next/server";
import { fetchFxRates } from "@/lib/portfolio/prices/fx";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimitJsonResponse(request, "fx", { max: 60 });
  if (limited) return limited;

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
