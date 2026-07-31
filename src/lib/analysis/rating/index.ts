import { combineInvestSalsaRating } from "@/lib/analysis/rating/combine";
import { computeFundamentalScore } from "@/lib/analysis/rating/fundamental";
import { computeTechnicalScore } from "@/lib/analysis/rating/technical";
import type {
  FundamentalInputs,
  FundamentalPeerContext,
  InvestSalsaRating,
  OhlcBar,
  PeerMetricRow,
} from "@/lib/analysis/rating/types";

export type { InvestSalsaRating, OhlcBar, FundamentalInputs };
export { ratingLabel } from "@/lib/analysis/rating/combine";
export { aggregateTo4h } from "@/lib/analysis/rating/technical";

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

  return combineInvestSalsaRating(fundamental, technical);
}
