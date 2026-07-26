import type { CSSProperties } from "react";

export function heatmapChangeClass(changePercent: number): string {
  if (changePercent >= 3) return "heatmap-tile--up-strong";
  if (changePercent >= 1) return "heatmap-tile--up-mid";
  if (changePercent >= 0.2) return "heatmap-tile--up-light";
  if (changePercent > -0.2) return "heatmap-tile--flat";
  if (changePercent > -1) return "heatmap-tile--down-light";
  if (changePercent > -3) return "heatmap-tile--down-mid";
  return "heatmap-tile--down-strong";
}

/** Continuous green/red intensity scaled to daily % change (Finviz-style). */
export function heatmapTileStyle(changePercent: number): CSSProperties {
  const clamped = Math.max(-8, Math.min(8, changePercent));

  if (Math.abs(clamped) < 0.12) {
    return { backgroundColor: "#262626", color: "#a3a3a3" };
  }

  if (clamped > 0) {
    const intensity = Math.min(1, clamped / 6);
    const red = Math.round(6 + (1 - intensity) * 18);
    const green = Math.round(70 + intensity * 130);
    const blue = Math.round(24 + (1 - intensity) * 20);
    return { backgroundColor: `rgb(${red}, ${green}, ${blue})`, color: "#fff" };
  }

  const intensity = Math.min(1, Math.abs(clamped) / 6);
  const red = Math.round(90 + intensity * 130);
  const green = Math.round(28 * (1 - intensity));
  const blue = Math.round(28 * (1 - intensity));
  return { backgroundColor: `rgb(${red}, ${green}, ${blue})`, color: "#fff" };
}

export function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`;
  }
  return `$${value.toLocaleString()}`;
}

export function formatHeatmapChange(change: number, changePercent: number): string {
  const sign = change >= 0 ? "+" : "";
  const pctSign = changePercent >= 0 ? "+" : "";
  return `${sign}$${Math.abs(change).toFixed(2)} (${pctSign}${changePercent.toFixed(2)}%)`;
}

export function formatNewsTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
