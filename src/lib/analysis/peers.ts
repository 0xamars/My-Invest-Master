import type {
  FundamentalPeerContext,
  PeerMetricRow,
} from "@/lib/analysis/rating/types";
import { isFmpConfigured } from "@/lib/market-data/config";
import { fetchFmpPeerBundle } from "@/lib/market-data/fmp/peers";

export type PeerBundle = {
  context: FundamentalPeerContext;
  peers: PeerMetricRow[];
};

/**
 * Granular peer context for fundamental scoring.
 * Primary: FMP stock peers + industry seeds.
 */
export async function fetchPeerBundle(input: {
  symbol: string;
  industryKey: string | null;
  industry: string | null;
  sectorKey: string | null;
  sector: string | null;
}): Promise<PeerBundle> {
  if (isFmpConfigured()) {
    return fetchFmpPeerBundle(input);
  }

  // Without FMP, fall back to seed-only peer set via FMP peer module's seeds path
  // by calling the same function (it still uses seeds when FMP peer list fails).
  // Seed fetches need ratios — skip if no FMP.
  return {
    context: {
      basis: "none",
      label: "No peer set (FMP_API_KEY required)",
      peerCount: 0,
      industryKey: input.industryKey,
      industry: input.industry,
      sectorKey: input.sectorKey,
      sector: input.sector,
    },
    peers: [],
  };
}
