import type { PeerMetricRow } from "@/lib/analysis/rating/types";
import { clamp, round1 } from "@/lib/analysis/rating/math";

export function peerValues(
  peers: PeerMetricRow[],
  key: keyof PeerMetricRow,
): number[] {
  return peers
    .map((p) => p[key])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

/** Percentile of `value` within `peers` (0–100). Higher = larger than more peers. */
export function percentileRank(
  value: number,
  peers: number[],
  higherIsBetter: boolean,
): number | null {
  const clean = peers.filter((v) => Number.isFinite(v));
  if (!Number.isFinite(value) || clean.length < 3) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  let below = 0;
  for (const p of sorted) {
    if (p < value) below += 1;
    else if (p === value) below += 0.5;
  }
  const raw = (below / sorted.length) * 100;
  return higherIsBetter ? raw : 100 - raw;
}

export function quartileNote(
  percentile: number | null,
  peerLabel: string,
): string | null {
  if (percentile == null) return null;
  if (percentile >= 75) return `Top quartile vs ${peerLabel}`;
  if (percentile <= 25) return `Bottom quartile vs ${peerLabel}`;
  return `Mid-pack vs ${peerLabel}`;
}

/**
 * Blend absolute threshold score with peer-relative percentile.
 * Top quartile boosts; bottom quartile penalizes — never fully replaces absolute.
 */
export function blendAbsoluteAndPeer(
  absoluteScore: number,
  percentile: number | null,
  weightPeer = 0.35,
): number {
  if (percentile == null) return round1(clamp(absoluteScore));
  const peerScore = clamp(percentile);
  const w = clamp(weightPeer, 0, 0.5);
  return round1(clamp((1 - w) * absoluteScore + w * peerScore));
}

/** Growth-aware valuation: expensive + strong growth is less punitive. */
export function growthAwareValuationScore(
  absoluteMultipleScore: number,
  growthRate: number | null,
  pegScore: number | null,
): number {
  let score = absoluteMultipleScore;

  if (growthRate != null && Number.isFinite(growthRate)) {
    if (absoluteMultipleScore < 40 && growthRate >= 0.2) {
      score += 12;
    } else if (absoluteMultipleScore < 40 && growthRate >= 0.1) {
      score += 7;
    } else if (absoluteMultipleScore > 70 && growthRate < 0) {
      score -= 12;
    } else if (absoluteMultipleScore > 70 && growthRate < 0.03) {
      score -= 6;
    }
  }

  if (pegScore != null) {
    score = 0.7 * score + 0.3 * pegScore;
  }

  return round1(clamp(score));
}
