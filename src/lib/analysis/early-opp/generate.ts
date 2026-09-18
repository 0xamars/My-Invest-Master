import { buildInvestSalsaRating } from "@/lib/analysis/rating";
import {
  EARLY_OPP_FRAMEWORK_ID,
  EARLY_OPP_FRAMEWORK_VERSION,
} from "@/lib/analysis/early-opp/steps";
import { extractEarlyOppFacts } from "@/lib/analysis/early-opp/facts";
import { EARLY_OPP_DISCLAIMER } from "@/lib/analysis/early-opp/format";
import { getEarlyOppQualitative } from "@/lib/analysis/early-opp/qualitative";
import { earlyOppCountsFromSteps, scoreEarlyOppSteps } from "@/lib/analysis/early-opp/score";
import type { EarlyOppPayload } from "@/lib/analysis/early-opp/types";
import { fetchAnalysisQuote } from "@/lib/analysis/quote";
import { investAssessPath } from "@/lib/invest/assess/paths";
import { getAnalysisPackage } from "@/lib/market-data/warehouse";
import { getTickerSnapshot } from "@/lib/ticker/get-snapshot";
import { investTickerPath, normalizeTickerSymbol } from "@/lib/ticker/symbol";

export async function buildEarlyOppPayload(
  rawSymbol: string,
): Promise<EarlyOppPayload | { error: string; status: number }> {
  const symbol = normalizeTickerSymbol(rawSymbol);
  if (!symbol) {
    return { error: "Enter a public ticker.", status: 400 };
  }

  const [snapshot, pkg] = await Promise.all([
    getTickerSnapshot(symbol),
    getAnalysisPackage(symbol, { includeHourly: true }).catch(() => null),
  ]);

  if (!snapshot.found && !pkg?.quote && !pkg?.profile) {
    return { error: `No Financial Modeling Prep read for ${symbol}.`, status: 404 };
  }

  const quote =
    pkg?.quote ??
    (await fetchAnalysisQuote({
      symbol,
      type: "stock",
      name: snapshot.profile.name ?? undefined,
    }));

  if (snapshot.profile.name && !quote.name) quote.name = snapshot.profile.name;
  if (snapshot.profile.description && !quote.description) {
    quote.description = snapshot.profile.description;
  }

  const price = quote.price ?? snapshot.quote.price;
  const athCandidates = [pkg?.ath, quote.week52High, snapshot.quote.week52High, price].filter(
    (value): value is number => value != null && value > 0,
  );
  const ath = athCandidates.length > 0 ? Math.max(...athCandidates) : null;

  const rating = pkg
    ? buildInvestSalsaRating({
        assetType: "stock",
        price,
        ath,
        fundamentals: pkg.fundamentals,
        peers: pkg.peers,
        peerContext: pkg.peerContext,
        dailyBars: pkg.dailyBars,
        hourlyBars: pkg.hourlyBars,
        symbol,
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
      })
    : null;

  const facts = extractEarlyOppFacts({ snapshot, pkg, rating });
  const { overlay, ai } = await getEarlyOppQualitative({ facts });
  const steps = scoreEarlyOppSteps(facts, overlay);

  return {
    quote,
    steps,
    counts: earlyOppCountsFromSteps(steps),
    disclaimer: EARLY_OPP_DISCLAIMER,
    meta: {
      frameworkId: EARLY_OPP_FRAMEWORK_ID,
      frameworkVersion: EARLY_OPP_FRAMEWORK_VERSION,
      packageDegraded: pkg?.degraded ?? false,
      confidenceNote: pkg?.confidenceNote ?? null,
      analysisHref: investTickerPath(symbol),
      assessHref: investAssessPath(symbol),
      ai,
    },
  };
}
