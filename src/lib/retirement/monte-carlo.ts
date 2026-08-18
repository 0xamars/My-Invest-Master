import {
  DEFAULT_VOLATILITY_BY_TYPE,
  type RetirementPlan,
  type YearProjection,
} from "@/types/retirement";
import {
  computeRetirementProjections,
  type ComputeProjectionOptions,
} from "@/lib/retirement/projections";

export const DEFAULT_MONTE_CARLO_PATHS = 750;

export interface MonteCarloPercentileBand {
  year: number;
  age: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloResult {
  paths: number;
  successCount: number;
  /** Share of paths with portfolio > 0 at plan end age. */
  successRate: number;
  percentiles: MonteCarloPercentileBand[];
}

/**
 * Volatility assumptions (annual, percent):
 * stock 15, crypto 50, cash 1, custom 10.
 * Returns are expectedCagr ± that vol, sampled from a normal. This is a
 * lightweight illustration — not a 1871 historical backtest.
 */
export function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomNormal(next: () => number): number {
  const u = Math.max(next(), Number.EPSILON);
  const v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function sampleAssetReturn(
  expectedCagr: number,
  volatility: number,
  next: () => number,
): number {
  return Math.max(-100, expectedCagr + volatility * randomNormal(next));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  const weight = index - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

export function isSuccessfulPath(projections: YearProjection[]): boolean {
  if (projections.length === 0) return false;
  return projections[projections.length - 1].closingBalance > 0;
}

export function runRetirementMonteCarlo(
  plan: RetirementPlan,
  options?: ComputeProjectionOptions & {
    paths?: number;
    seed?: number;
  },
): MonteCarloResult {
  const paths = Math.max(1, options?.paths ?? DEFAULT_MONTE_CARLO_PATHS);

  if (plan.assets.length === 0) {
    return {
      paths,
      successCount: 0,
      successRate: 0,
      percentiles: [],
    };
  }

  const next = createMulberry32(options?.seed ?? 1);
  const closingsByYear = new Map<number, number[]>();
  const ageByYear = new Map<number, number>();
  let successCount = 0;

  for (let path = 0; path < paths; path += 1) {
    const projections = computeRetirementProjections(plan, {
      currentYear: options?.currentYear,
      horizonYears: options?.horizonYears,
      growthRatesForYear: () => {
        const growthRates: Record<string, number> = {};
        for (const asset of plan.assets) {
          growthRates[asset.id] = sampleAssetReturn(
            asset.expectedCagr,
            DEFAULT_VOLATILITY_BY_TYPE[asset.type],
            next,
          );
        }
        return growthRates;
      },
    });

    if (isSuccessfulPath(projections)) {
      successCount += 1;
    }

    for (const row of projections) {
      const bucket = closingsByYear.get(row.year);
      if (bucket) {
        bucket.push(row.closingBalance);
      } else {
        closingsByYear.set(row.year, [row.closingBalance]);
      }
      ageByYear.set(row.year, row.age);
    }
  }

  const percentiles: MonteCarloPercentileBand[] = [...closingsByYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        year,
        age: ageByYear.get(year) ?? 0,
        p10: percentile(sorted, 0.1),
        p50: percentile(sorted, 0.5),
        p90: percentile(sorted, 0.9),
      };
    });

  return {
    paths,
    successCount,
    successRate: successCount / paths,
    percentiles,
  };
}
