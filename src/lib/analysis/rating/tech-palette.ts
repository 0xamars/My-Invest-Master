/**
 * Shared Analysis score coloring (Fundamental + Technical).
 *
 * Discrete 0–100 bands (no continuous gradient):
 *   0–19 deep red · 20–39 orange · 40–59 yellow/amber · 60–79 green · 80–100 dark green
 *
 * Heat band ids (TechHeatId) remain for Technical labels/scoring only — not for UI color.
 * BLOOD IN THE STREETS! (grey zone) forces red chip styling regardless of numeric score band.
 */
import type { CSSProperties } from "react";
import type { TechHeatId } from "@/lib/analysis/rating/types";

export type { TechHeatId };

export type ScoreColorBand =
  | "deep_red"
  | "orange"
  | "yellow"
  | "green"
  | "dark_green";

type Rgb = readonly [number, number, number];

/** Dark-theme readable band tokens. */
const SCORE_BAND_RGB: Record<ScoreColorBand, Rgb> = {
  deep_red: [220, 38, 38], // red-600
  orange: [249, 115, 22], // orange-500
  yellow: [245, 158, 11], // amber-500
  green: [34, 197, 94], // green-500
  dark_green: [5, 120, 87], // emerald-700
};

/** BLOOD IN THE STREETS! — forced red chip (special grey-zone exception). */
export const TECH_BLOOD_CHIP_CLASS =
  "border-red-500/45 bg-red-500/10 text-red-500 uppercase tracking-wide font-semibold";

function rgbCss(rgb: Rgb): string {
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

function rgbaCss(rgb: Rgb, alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Map a 0–100 score onto a discrete color band.
 * 0–19 deep red · 20–39 orange · 40–59 yellow · 60–79 green · 80–100 dark green
 */
export function scoreColorBand(
  score: number | null | undefined,
): ScoreColorBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score < 20) return "deep_red";
  if (score < 40) return "orange";
  if (score < 60) return "yellow";
  if (score < 80) return "green";
  return "dark_green";
}

/** Band RGB for a score, or null when unavailable. */
export function scoreToRgb(score: number | null | undefined): Rgb | null {
  const band = scoreColorBand(score);
  if (band == null) return null;
  return SCORE_BAND_RGB[band];
}

/** CSS color string, or null when score is unavailable. */
export function scoreColorCss(
  score: number | null | undefined,
): string | null {
  const rgb = scoreToRgb(score);
  return rgb ? rgbCss(rgb) : null;
}

export function scoreColorRgba(
  score: number | null | undefined,
  alpha: number,
): string | null {
  const rgb = scoreToRgb(score);
  return rgb ? rgbaCss(rgb, alpha) : null;
}

/** Inline style for numeric score text. */
export function scoreTextStyle(
  score: number | null | undefined,
): CSSProperties | undefined {
  const color = scoreColorCss(score);
  return color ? { color } : undefined;
}

/** Inline style for bar / progress fills. */
export function scoreBarFillStyle(
  score: number | null | undefined,
): CSSProperties | undefined {
  const backgroundColor = scoreColorCss(score);
  return backgroundColor ? { backgroundColor } : undefined;
}

/**
 * Chip accent from discrete score band — readable on dark theme.
 * Border/text use full color; background uses a soft tint.
 */
export function scoreChipStyle(
  score: number | null | undefined,
): CSSProperties | undefined {
  const rgb = scoreToRgb(score);
  if (rgb == null) return undefined;
  return {
    color: rgbCss(rgb),
    backgroundColor: rgbaCss(rgb, 0.14),
    borderColor: rgbaCss(rgb, 0.5),
  };
}

/** Prefer scoreTextStyle for color; class only handles missing scores. */
export function scoreHeatTextClass(
  score: number | null | undefined,
): string {
  if (score == null || !Number.isFinite(score)) {
    return "text-muted-foreground";
  }
  return "";
}

/** Path-agnostic layer labels — location only, no Z-score / SD jargon. */
export const TECH_HEAT_LABELS: Record<TechHeatId, string> = {
  dark_green: "FAR BELOW",
  green: "BELOW",
  teal: "SLIGHTLY BELOW",
  yellow: "SLIGHTLY ABOVE",
  orange: "ABOVE",
  red: "FAR ABOVE",
};

/** Price mean extension TF scores from priceZ layer bands (scoring math only). */
export const TECH_HEAT_SCORES: Record<TechHeatId, number> = {
  dark_green: 90, // Z < -2
  green: 75, // -2 ≤ Z < -1
  teal: 60, // -1 ≤ Z ≤ 0
  yellow: 45, // 0 < Z ≤ 1
  orange: 30, // 1 < Z ≤ 2
  red: 15, // Z > 2
};

/**
 * Map priceZ to the shared layer band (labels/scores — not UI color).
 * Boundaries: Z>2 red · (1,2] orange · (0,1] yellow · [-1,0] teal · [-2,-1) green · Z<-2 dark green
 */
export function heatFromPriceZ(priceZ: number): TechHeatId {
  if (priceZ > 2) return "red";
  if (priceZ > 1) return "orange";
  if (priceZ > 0) return "yellow";
  if (priceZ >= -1) return "teal";
  if (priceZ >= -2) return "green";
  return "dark_green";
}

/** Location framing for Price zone chips — not a trade order. */
export function priceZoneLocationHint(
  zone: string | null | undefined,
): string | null {
  switch (zone) {
    case "grey":
      return "Deep pullback — historically better ownership location";
    case "dark_green":
      return "Deep pullback — better location than chasing strength";
    case "green":
      return "Pulled back — more constructive location";
    case "yellow":
      return "Mid-range — neither deeply discounted nor stretched";
    case "orange":
      return "Getting extended — wait for a pullback for a better location";
    case "red":
      return "Extended / FOMO territory — wait for a pullback rather than chase";
    default:
      return null;
  }
}

/** Location framing for Price mean extension layers — not a trade order. */
export function extensionLocationHint(
  heat: TechHeatId | null | undefined,
): string | null {
  switch (heat) {
    case "dark_green":
      return "Far below recent mean — better location";
    case "green":
      return "Below recent mean — constructive location";
    case "teal":
      return "Slightly below recent mean — near fair location";
    case "yellow":
      return "Slightly above recent mean — mild extension";
    case "orange":
      return "Above recent mean — wait for a pullback";
    case "red":
      return "Far above recent mean — wait for a pullback";
    default:
      return null;
  }
}
