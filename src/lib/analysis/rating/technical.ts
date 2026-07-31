import {
  CONFLUENCE_SCORES,
  FIB_ZONE_LABELS,
  FIB_ZONE_SCORES,
  MACD_FAST,
  MACD_LOOKBACK,
  MACD_SIGNAL,
  MACD_SLOW,
  MACD_THRESHOLD,
  TECH_1D_WEIGHT,
  TECH_4H_WEIGHT,
  TECH_FIB_WEIGHT,
} from "@/lib/analysis/rating/bands";
import {
  clamp,
  macdHistogram,
  round1,
  trailingZScore,
  weightedAverage,
} from "@/lib/analysis/rating/math";
import type {
  ConfluenceSignal,
  ConfluenceStatus,
  FibZoneId,
  FibZoneResult,
  OhlcBar,
  TechnicalResult,
  TimeframeConfluence,
} from "@/lib/analysis/rating/types";

/**
 * Zone mapping on fibPosition where 0 = ATH and 1 = $0:
 * 1.000–0.786 Grey · 0.786–0.618 Dark Green · 0.618–0.500 Green ·
 * 0.500–0.382 Yellow · 0.382–0.236 Orange · 0.236–0.000 Red
 */
function resolveFibZone(fibPosition: number): FibZoneId {
  if (fibPosition >= 0.786) return "grey";
  if (fibPosition >= 0.618) return "dark_green";
  if (fibPosition >= 0.5) return "green";
  if (fibPosition >= 0.382) return "yellow";
  if (fibPosition >= 0.236) return "orange";
  return "red";
}

/**
 * fibPosition = (ATH - currentPrice) / ATH
 * Level 0 = ATH, level 1 = $0; rises as price falls from ATH.
 */
export function computeFibZone(
  price: number | null,
  ath: number | null,
): FibZoneResult {
  if (
    price == null ||
    ath == null ||
    !Number.isFinite(price) ||
    !Number.isFinite(ath) ||
    ath <= 0 ||
    price < 0
  ) {
    return {
      level: null,
      ath,
      price,
      zone: null,
      zoneLabel: null,
      score: null,
    };
  }

  // At/above ATH → 0; below ATH toward $0 → approaches 1.
  const raw = price > ath ? 0 : (ath - price) / ath;
  const fibPosition = clamp(raw, 0, 1);
  // Round before zone mapping so displayed fib and badge stay consistent.
  const level = round1(fibPosition * 1000) / 1000;
  const zone = resolveFibZone(level);
  return {
    level,
    ath,
    price,
    zone,
    zoneLabel: FIB_ZONE_LABELS[zone],
    score: FIB_ZONE_SCORES[zone],
  };
}

function confluenceScore(
  signal: ConfluenceSignal,
  status: ConfluenceStatus,
): number {
  if (signal === "Buy") return CONFLUENCE_SCORES.buy;
  if (signal === "Sell") return CONFLUENCE_SCORES.sell;
  if (status === "Green") return CONFLUENCE_SCORES.none_green;
  if (status === "Red") return CONFLUENCE_SCORES.none_red;
  return 50;
}

export function computeTimeframeConfluence(
  timeframe: "1D" | "4H",
  bars: OhlcBar[] | null | undefined,
): TimeframeConfluence {
  const empty: TimeframeConfluence = {
    timeframe,
    available: false,
    priceZ: null,
    macdZ: null,
    status: null,
    signal: null,
    score: null,
    barsUsed: 0,
  };

  if (!bars || bars.length < MACD_SLOW + MACD_SIGNAL) {
    return empty;
  }

  const closes = bars
    .map((b) => b.close)
    .filter((c) => Number.isFinite(c) && c > 0);
  if (closes.length < MACD_SLOW + MACD_SIGNAL) {
    return empty;
  }

  const hist = macdHistogram(closes, MACD_FAST, MACD_SLOW, MACD_SIGNAL);
  const priceZ = trailingZScore(
    closes.map((c) => c as number | null),
    MACD_LOOKBACK,
  );
  const macdZ = trailingZScore(hist, MACD_LOOKBACK);

  if (priceZ == null || macdZ == null) {
    return {
      ...empty,
      barsUsed: closes.length,
    };
  }

  let status: ConfluenceStatus = "Neutral";
  if (priceZ > 0) status = "Red";
  else if (priceZ < 0) status = "Green";

  let signal: ConfluenceSignal = "None";
  if (priceZ <= -MACD_THRESHOLD && macdZ <= -MACD_THRESHOLD) {
    signal = "Buy";
  } else if (priceZ >= MACD_THRESHOLD && macdZ >= MACD_THRESHOLD) {
    signal = "Sell";
  }

  return {
    timeframe,
    available: true,
    priceZ: round1(priceZ * 100) / 100,
    macdZ: round1(macdZ * 100) / 100,
    status,
    signal,
    score: confluenceScore(signal, status),
    barsUsed: closes.length,
  };
}

/** Aggregate 1h bars into 4h OHLC without inventing prices. */
export function aggregateTo4h(hourly: OhlcBar[]): OhlcBar[] {
  if (hourly.length === 0) return [];
  const sorted = [...hourly].sort((a, b) => a.time - b.time);
  const buckets = new Map<number, OhlcBar[]>();

  for (const bar of sorted) {
    const date = new Date(bar.time);
    const hour = date.getUTCHours();
    const bucketHour = Math.floor(hour / 4) * 4;
    const key = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      bucketHour,
    );
    const list = buckets.get(key) ?? [];
    list.push(bar);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, group]) => {
      const open = group[0]!.open;
      const close = group[group.length - 1]!.close;
      const high = Math.max(...group.map((g) => g.high));
      const low = Math.min(...group.map((g) => g.low));
      const volume = group.reduce(
        (sum, g) => sum + (g.volume ?? 0),
        0,
      );
      return { time, open, high, low, close, volume };
    })
    .filter(
      (b) =>
        Number.isFinite(b.open) &&
        Number.isFinite(b.high) &&
        Number.isFinite(b.low) &&
        Number.isFinite(b.close),
    );
}

export function computeTechnicalScore(input: {
  price: number | null;
  ath: number | null;
  dailyBars: OhlcBar[] | null;
  hourlyBars: OhlcBar[] | null;
}): TechnicalResult {
  const notes: string[] = [];
  const fib = computeFibZone(input.price, input.ath);
  if (fib.score == null) {
    notes.push("Fibonacci zone unavailable — missing price or ATH.");
  }

  const daily = computeTimeframeConfluence("1D", input.dailyBars);
  if (!daily.available) {
    notes.push("1D Price/MACD confluence unavailable.");
  }

  const h4Bars =
    input.hourlyBars && input.hourlyBars.length > 0
      ? aggregateTo4h(input.hourlyBars)
      : null;
  const h4 = computeTimeframeConfluence("4H", h4Bars);
  if (!h4.available) {
    notes.push("4H data unavailable — scoring without 4H confluence.");
  }

  const parts: Array<{ weight: number; value: number }> = [];
  if (fib.score != null) {
    parts.push({ weight: TECH_FIB_WEIGHT, value: fib.score });
  }
  if (daily.score != null) {
    parts.push({ weight: TECH_1D_WEIGHT, value: daily.score });
  }
  if (h4.score != null) {
    parts.push({ weight: TECH_4H_WEIGHT, value: h4.score });
  }

  const raw = weightedAverage(parts);
  const score = raw == null ? null : round1(clamp(raw));

  return {
    available: score != null,
    score,
    fib,
    daily,
    h4,
    notes,
  };
}
