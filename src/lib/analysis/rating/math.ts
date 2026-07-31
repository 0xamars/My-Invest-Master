export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function weightedAverage(
  parts: Array<{ weight: number; value: number }>,
): number | null {
  const usable = parts.filter(
    (p) => Number.isFinite(p.value) && Number.isFinite(p.weight) && p.weight > 0,
  );
  if (usable.length === 0) return null;
  const totalWeight = usable.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return null;
  return usable.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight;
}

export function ema(values: number[], period: number): number[] {
  if (period <= 0 || values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0]!;
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function macdLine(
  closes: number[],
  fast: number,
  slow: number,
): Array<number | null> {
  if (closes.length < slow) return closes.map(() => null);
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  return closes.map((_, i) => {
    if (i < slow - 1) return null;
    return fastEma[i]! - slowEma[i]!;
  });
}

export function macdHistogram(
  closes: number[],
  fast: number,
  slow: number,
  signalPeriod: number,
): Array<number | null> {
  const line = macdLine(closes, fast, slow);
  const result: Array<number | null> = closes.map(() => null);
  const pairs: Array<{ index: number; value: number }> = [];
  for (let i = 0; i < line.length; i++) {
    const value = line[i];
    if (value != null) pairs.push({ index: i, value });
  }
  if (pairs.length < signalPeriod) return result;
  const signal = ema(
    pairs.map((p) => p.value),
    signalPeriod,
  );
  for (let j = 0; j < pairs.length; j++) {
    result[pairs[j]!.index] = pairs[j]!.value - signal[j]!;
  }
  return result;
}

/** Z-score of the last value vs the prior `lookback` window (including last). */
export function trailingZScore(
  series: Array<number | null>,
  lookback: number,
): number | null {
  const numeric = series.filter((v): v is number => v != null && Number.isFinite(v));
  if (numeric.length < Math.min(20, lookback)) return null;
  const window = numeric.slice(-lookback);
  if (window.length < 2) return null;
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  const variance =
    window.reduce((s, v) => s + (v - mean) ** 2, 0) / (window.length - 1);
  const std = Math.sqrt(variance);
  if (!Number.isFinite(std) || std === 0) return null;
  return (window[window.length - 1]! - mean) / std;
}

export function formatRatio(value: number | null, digits = 2): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(digits);
}

export function formatPercentDecimal(
  value: number | null,
  digits = 1,
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatMultiple(value: number | null, digits = 1): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value.toFixed(digits)}x`;
}
