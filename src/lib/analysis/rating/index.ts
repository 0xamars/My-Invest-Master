import { combineInvestSalsaRating } from "@/lib/analysis/rating/combine";
import { computeFundamentalScore } from "@/lib/analysis/rating/fundamental";
import { computeTechnicalScore } from "@/lib/analysis/rating/technical";
import type {
  FairValueResult,
  FundamentalInputs,
  FundamentalPeerContext,
  InvestSalsaRating,
  OhlcBar,
  PeerMetricRow,
} from "@/lib/analysis/rating/types";

export type { InvestSalsaRating, OhlcBar, FundamentalInputs };
export { ratingLabel } from "@/lib/analysis/rating/combine";
export { aggregateTo4h, aggregateToWeekly } from "@/lib/analysis/rating/technical";

/** Dormant Fair Value stub — not computed or shown in Analysis UI. */
function dormantFairValue(): FairValueResult {
  return {
    available: false,
    version: "v1.2",
    label: null,
    takeaway: null,
    confidence: "Low",
    price: null,
    scenarios: { base: null, upside: null, disruptive: null },
    range: { low: null, mid: null, high: null },
    bands: {
      plus30: null,
      plus10: null,
      fairLow: null,
      fairHigh: null,
      minus10: null,
      minus30: null,
    },
    upsidePctVsBase: null,
    downsidePctVsBase: null,
    upsidePctVsMid: null,
    optionality: {
      score: null,
      label: null,
      reasons: [],
      reasonCodes: [],
    },
    inputsUsed: [],
    missingInputs: [],
    notes: ["Fair Value Assessment is disabled in Analysis UI."],
    disruptiveEnabled: false,
    disruptiveDisabledReason: "Fair Value removed from product surface.",
  };
}

export function buildInvestSalsaRating(input: {
  assetType: "stock" | "crypto";
  price: number | null;
  ath: number | null;
  fundamentals: FundamentalInputs | null;
  peers?: PeerMetricRow[];
  peerContext?: FundamentalPeerContext;
  dailyBars: OhlcBar[] | null;
  hourlyBars: OhlcBar[] | null;
}): InvestSalsaRating {
  const fundamental = computeFundamentalScore(
    input.assetType === "stock" ? input.fundamentals : null,
    {
      applicable: input.assetType === "stock",
      peers: input.peers,
      peerContext: input.peerContext,
    },
  );

  const technical = computeTechnicalScore({
    price: input.price,
    ath: input.ath,
    dailyBars: input.dailyBars,
    hourlyBars: input.hourlyBars,
  });

  const rating = combineInvestSalsaRating(fundamental, technical);

  return {
    ...rating,
    // Keep field for type compatibility; never surface in UI
    fairValue: dormantFairValue(),
  };
}
