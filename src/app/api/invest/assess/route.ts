import { NextResponse } from "next/server";
import { buildInvestSalsaRating } from "@/lib/analysis/rating";
import { fetchAnalysisQuote } from "@/lib/analysis/quote";
import { parseAnalysisAssetType } from "@/lib/analysis/types";
import {
  buildAssessNote,
  buildTapeFromPackage,
} from "@/lib/invest/assess";
import { investAssessPath } from "@/lib/invest/assess/paths";
import { getAnalysisPackage } from "@/lib/market-data/warehouse";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimitJsonResponse(request, "invest-assess", { max: 40 });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim() ?? "";
    const type = parseAnalysisAssetType(searchParams.get("type"));
    const name = searchParams.get("name") ?? undefined;

    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    if (type !== "stock") {
      return NextResponse.json(
        { error: "Assess tape supports public equities first." },
        { status: 400 },
      );
    }

    const pkg = await getAnalysisPackage(symbol, { includeHourly: true });

    const quote =
      pkg.quote ??
      (await fetchAnalysisQuote({ symbol, type: "stock", name }));

    if (pkg.quote && name && !quote.name) {
      quote.name = name;
    }
    if (pkg.profile?.description && !quote.description) {
      quote.description = pkg.profile.description;
    }

    const price = quote.price;
    const athCandidates = [pkg.ath, quote.week52High, price].filter(
      (v): v is number => v != null && v > 0,
    );
    const ath =
      athCandidates.length > 0 ? Math.max(...athCandidates) : null;

    const rating = buildInvestSalsaRating({
      assetType: "stock",
      price,
      ath,
      fundamentals: pkg.fundamentals,
      peers: pkg.peers,
      peerContext: pkg.peerContext,
      dailyBars: pkg.dailyBars,
      hourlyBars: pkg.hourlyBars,
      symbol: symbol.toUpperCase(),
      vehicleProfile: pkg.profile
        ? {
            name: pkg.profile.name,
            industry: pkg.profile.industry,
            industryKey: pkg.profile.industryKey,
            sector: pkg.profile.sector,
            sectorKey: pkg.profile.sectorKey,
            description: pkg.profile.description,
            exchange: pkg.profile.exchange,
            isEtf: pkg.profile.isEtf,
            isFund: pkg.profile.isFund,
            raw: pkg.profile.raw,
          }
        : null,
    });

    const tape = buildTapeFromPackage(pkg);
    const note = buildAssessNote({ pkg, rating, tape });

    return NextResponse.json({
      quote,
      rating,
      tape,
      note,
      meta: {
        packageDegraded: pkg.degraded,
        confidenceNote: pkg.confidenceNote,
        analysisHref: `/analysis/${encodeURIComponent(symbol.toUpperCase())}`,
        assessHref: investAssessPath(symbol),
      },
    });
  } catch (error) {
    console.error("Invest assess error:", error);
    return NextResponse.json(
      { error: "Failed to load assess workspace" },
      { status: 500 },
    );
  }
}
