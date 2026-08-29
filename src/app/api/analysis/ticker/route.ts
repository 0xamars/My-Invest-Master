import { NextResponse } from "next/server";
import { getTickerSnapshot } from "@/lib/ticker/get-snapshot";
import { normalizeTickerSymbol } from "@/lib/ticker/symbol";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const limited = rateLimitJsonResponse(request, "analysis-ticker", { max: 40 });
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = normalizeTickerSymbol(searchParams.get("symbol"));
  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const snapshot = await getTickerSnapshot(symbol);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Ticker read error:", error);
    return NextResponse.json(
      { error: "Failed to load ticker from Financial Modeling Prep" },
      { status: 500 },
    );
  }
}
