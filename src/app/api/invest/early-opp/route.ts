import { NextResponse } from "next/server";
import { buildEarlyOppPayload } from "@/lib/analysis/early-opp/generate";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const limited = rateLimitJsonResponse(request, "invest-early-opp", { max: 30 });
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim() ?? "";

  try {
    const result = await buildEarlyOppPayload(symbol);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Early Opp error:", error);
    return NextResponse.json(
      { error: "Failed to load the 16-step framework" },
      { status: 500 },
    );
  }
}
