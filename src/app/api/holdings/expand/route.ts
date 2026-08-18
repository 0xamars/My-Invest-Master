import { NextResponse } from "next/server";
import { requireAssistantAuth } from "@/lib/assistant/auth";
import { fetchHeadlineForSymbol } from "@/lib/market/fetch-news";
import { fetchAnalysisQuote } from "@/lib/analysis/quote";
import { getAnalysisPackage } from "@/lib/market-data/warehouse";
import {
  buildHoldingExpandFacts,
  type HoldingHeadline,
} from "@/lib/portfolio/holding-expand";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";
import type { AssetType } from "@/types/portfolio";

function parseAssetType(value: string | null): AssetType {
  if (value === "crypto" || value === "cash" || value === "custom") return value;
  return "stock";
}

export async function GET(request: Request) {
  const auth = await requireAssistantAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error ?? "Sign in to continue." },
      { status: 401 },
    );
  }

  const limited = rateLimitJsonResponse(request, "holding-expand", { max: 40 });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim().toUpperCase() ?? "";
    const type = parseAssetType(searchParams.get("type"));
    const priceId = searchParams.get("priceId") ?? undefined;
    const name = searchParams.get("name") ?? undefined;

    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    if (type !== "stock") {
      const quote =
        type === "crypto"
          ? await fetchAnalysisQuote({ symbol, type: "crypto", priceId, name })
          : null;
      return NextResponse.json(
        buildHoldingExpandFacts({
          type,
          whyMoved: {
            change: quote?.change ?? null,
            changePercent: quote?.changePercent ?? null,
            volume: quote?.volume ?? null,
            averageVolume: quote?.averageVolume ?? null,
          },
        }),
      );
    }

    const [quote, pkg, headline] = await Promise.all([
      fetchAnalysisQuote({ symbol, type: "stock", priceId, name }),
      getAnalysisPackage(symbol, { includeHourly: false }),
      fetchHeadlineForSymbol(symbol),
    ]);

    const mappedHeadline: HoldingHeadline | null = headline
      ? {
          title: headline.title,
          publisher: headline.publisher,
          link: headline.link,
        }
      : null;

    const incomeRows = pkg.statements.income.annual ?? [];
    const statementBalance =
      pkg.statements.balance.annual[0] ?? pkg.statements.balance.quarter[0] ?? null;
    const balanceRow =
      statementBalance ??
      (pkg.fundamentals
        ? {
            cashAndShortTermInvestments: pkg.fundamentals.totalCash,
            totalDebt: pkg.fundamentals.totalDebt,
          }
        : null);

    return NextResponse.json(
      buildHoldingExpandFacts({
        type: "stock",
        whyMoved: {
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          averageVolume: quote.averageVolume,
          headline: mappedHeadline,
        },
        incomeRows,
        balanceRow,
        earningsRaw: (pkg.profile?.raw ?? null) as Record<string, unknown> | null,
      }),
    );
  } catch (error) {
    console.error("Holding expand error:", error);
    return NextResponse.json(
      { error: "Failed to load holding facts" },
      { status: 500 },
    );
  }
}
