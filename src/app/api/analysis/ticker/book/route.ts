import { after } from "next/server";
import { NextResponse } from "next/server";
import { quoteFromSnapshot, type BookTickerQuote } from "@/lib/ticker/book";
import {
  getTickerSnapshot,
  peekTickerSnapshot,
} from "@/lib/ticker/get-snapshot";
import { normalizeTickerSymbol } from "@/lib/ticker/symbol";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

const MAX_SYMBOLS = 24;

export async function GET(request: Request) {
  const limited = rateLimitJsonResponse(request, "analysis-ticker-book", {
    max: 40,
  });
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((item) => normalizeTickerSymbol(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, MAX_SYMBOLS);

  const unique = [...new Set(symbols)];
  const quotes: BookTickerQuote[] = [];
  const stale: string[] = [];

  for (const symbol of unique) {
    const snapshot = await peekTickerSnapshot(symbol);
    if (!snapshot) {
      quotes.push(quoteFromSnapshot(symbol, null, "miss"));
      continue;
    }
    if (snapshot.cache.status === "stale") stale.push(symbol);
    quotes.push(quoteFromSnapshot(symbol, snapshot, snapshot.cache.status));
  }

  if (stale.length) {
    try {
      after(() => {
        for (const symbol of stale) {
          void getTickerSnapshot(symbol).catch(() => undefined);
        }
      });
    } catch {
      // Request context without after() — next ticker open will refresh.
    }
  }

  return NextResponse.json({ quotes });
}
