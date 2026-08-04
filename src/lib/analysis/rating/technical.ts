import {
  FIB_ZONE_LABELS,
  FIB_ZONE_SCORES,
  MACD_FAST,
  MACD_LOOKBACK,
  MACD_SIGNAL,
  MACD_SLOW,
  TECH_1D_WEIGHT,
  TECH_1W_WEIGHT,
  TECH_4H_WEIGHT,
  TECH_FIB_WEIGHT,
} from "@/lib/analysis/rating/bands";
import {
  heatFromPriceZ,
  TECH_HEAT_LABELS,
  TECH_HEAT_SCORES,
} from "@/lib/analysis/rating/tech-palette";
import {
  clamp,
  macdHistogram,
  round1,
  trailingZScore,
  weightedAverage,
} from "@/lib/analysis/rating/math";
import type {
  ConfluenceStatus,
  FibZoneId,
  FibZoneResult,
  OhlcBar,
  TechnicalResult,
  TimeframeConfluence,
} from "@/lib/analysis/rating/types";

const TF_LABEL: Record<
  TimeframeConfluence["timeframe"],
  TimeframeConfluence["label"]
> = {
  "4H": "NEAR TERM",
  "1D": "MEDIUM TERM",
  "1W": "LONG TERM",
};

/**
 * Zone mapping on price position where 0 = ATH and 1 = $0:
 * ≥0.786 BLOOD IN THE STREETS! · ≥0.618 BUY THE FEAR · ≥0.500 DIP SEASON ·
 * ≥0.382 CHOP ZONE · ≥0.236 GETTING SPICY · <0.236 FOMO ZONE
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

/**
 * Price mean extension TF score from shared layer bands (priceZ).
 * Labels are location-only (FAR BELOW … FAR ABOVE); Buy/Sell stays deferred.
 */
function heatToLegacyStatus(heat: ReturnType<typeof heatFromPriceZ>): ConfluenceStatus {
  if (heat === "red" || heat === "orange") return "Red";
  if (heat === "dark_green" || heat === "green" || heat === "teal") return "Green";
  return "Neutral";
}

export function computeTimeframeConfluence(
  timeframe: TimeframeConfluence["timeframe"],
  bars: OhlcBar[] | null | undefined,
): TimeframeConfluence {
  const label = TF_LABEL[timeframe];
  const empty: TimeframeConfluence = {
    timeframe,
    label,
    available: false,
    priceZ: null,
    macdZ: null,
    status: null,
    heat: null,
    heatLabel: null,
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
  // MACD Z retained internally for a future signal revision; not used for scoring/UI now.
  const macdZ = trailingZScore(hist, MACD_LOOKBACK);

  if (priceZ == null) {
    return {
      ...empty,
      barsUsed: closes.length,
      macdZ: macdZ != null ? round1(macdZ * 100) / 100 : null,
    };
  }

  const heat = heatFromPriceZ(priceZ);
  const status = heatToLegacyStatus(heat);

  // Explicit Buy/Sell generation disabled — revisit later with dedicated trade-signal UX.

  return {
    timeframe,
    label,
    available: true,
    priceZ: round1(priceZ * 100) / 100,
    macdZ: macdZ != null ? round1(macdZ * 100) / 100 : null,
    status,
    heat,
    heatLabel: TECH_HEAT_LABELS[heat],
    signal: null,
    score: TECH_HEAT_SCORES[heat],
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
      const volume = group.reduce((sum, g) => sum + (g.volume ?? 0), 0);
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

/** Monday UTC of the ISO-style week containing `time` (ms). */
function weekStartUtcMs(time: number): number {
  const d = new Date(time);
  const day = d.getUTCDay(); // 0 = Sun … 6 = Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + offsetToMonday,
  );
}

/** Aggregate daily bars into weekly OHLC (Monday-start UTC weeks). */
export function aggregateToWeekly(daily: OhlcBar[]): OhlcBar[] {
  if (daily.length === 0) return [];
  const sorted = [...daily].sort((a, b) => a.time - b.time);
  const buckets = new Map<number, OhlcBar[]>();

  for (const bar of sorted) {
    const key = weekStartUtcMs(bar.time);
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
      const volume = group.reduce((sum, g) => sum + (g.volume ?? 0), 0);
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
  const minBars = MACD_SLOW + MACD_SIGNAL;

  const dailyCount = input.dailyBars?.length ?? 0;
  const hourlyCount = input.hourlyBars?.length ?? 0;

  if (dailyCount === 0 && hourlyCount === 0) {
    notes.push(
      "No FMP price history in package — Technical score unavailable.",
    );
  } else if (dailyCount > 0 && dailyCount < minBars) {
    notes.push(
      `MEDIUM TERM history thin (${dailyCount} daily bars; need ≥${minBars}) — momentum degraded.`,
    );
  }

  const fib = computeFibZone(input.price, input.ath);
  if (fib.score == null) {
    notes.push("Price zone unavailable — missing price or ATH.");
  } else if (
    fib.ath != null &&
    fib.price != null &&
    fib.price > fib.ath
  ) {
    notes.push("Price at/above package ATH — price zone pinned at ATH.");
  }

  // MEDIUM TERM — 1D
  const daily = computeTimeframeConfluence("1D", input.dailyBars);
  if (!daily.available) {
    notes.push(
      dailyCount === 0
        ? "MEDIUM TERM unavailable — no daily bars."
        : `MEDIUM TERM unavailable (${dailyCount} daily bars).`,
    );
  }

  // NEAR TERM — 4H from hourly
  const h4Bars =
    input.hourlyBars && input.hourlyBars.length > 0
      ? aggregateTo4h(input.hourlyBars)
      : null;
  const h4Count = h4Bars?.length ?? 0;
  if (hourlyCount > 0 && h4Count < minBars) {
    notes.push(
      `NEAR TERM thin (${hourlyCount} hourly → ${h4Count} 4H bars; need ≥${minBars}) — scoring without NEAR TERM.`,
    );
  }
  const h4 = computeTimeframeConfluence("4H", h4Bars);
  if (!h4.available) {
    notes.push(
      hourlyCount === 0
        ? "NEAR TERM unavailable — no hourly bars."
        : "NEAR TERM unavailable after aggregating hourly bars.",
    );
  }

  // LONG TERM — 1W from daily
  const weeklyBars =
    input.dailyBars && input.dailyBars.length > 0
      ? aggregateToWeekly(input.dailyBars)
      : null;
  const weeklyCount = weeklyBars?.length ?? 0;
  if (dailyCount > 0 && weeklyCount < minBars) {
    notes.push(
      `LONG TERM thin (${dailyCount} daily → ${weeklyCount} weekly bars; need ≥${minBars}) — scoring without LONG TERM.`,
    );
  }
  const weekly = computeTimeframeConfluence("1W", weeklyBars);
  if (!weekly.available) {
    notes.push(
      dailyCount === 0
        ? "LONG TERM unavailable — no daily bars to aggregate."
        : "LONG TERM unavailable after aggregating weekly bars.",
    );
  }

  // Weights: zone 0.34 · NEAR 0.22 · MEDIUM 0.22 · LONG 0.22 — renormalize if any missing
  const parts: Array<{ weight: number; value: number }> = [];
  if (fib.score != null) {
    parts.push({ weight: TECH_FIB_WEIGHT, value: fib.score });
  }
  if (h4.score != null) {
    parts.push({ weight: TECH_4H_WEIGHT, value: h4.score });
  }
  if (daily.score != null) {
    parts.push({ weight: TECH_1D_WEIGHT, value: daily.score });
  }
  if (weekly.score != null) {
    parts.push({ weight: TECH_1W_WEIGHT, value: weekly.score });
  }

  const raw = weightedAverage(parts);
  const score = raw == null ? null : round1(clamp(raw));

  const expectedComponents = 4;
  if (score != null && parts.length < expectedComponents) {
    notes.push(
      `Technical confidence reduced — ${parts.length}/${expectedComponents} components available (price zone, NEAR, MEDIUM, LONG).`,
    );
  }

  return {
    available: score != null,
    score,
    fib,
    daily,
    h4,
    weekly,
    notes,
  };
}
