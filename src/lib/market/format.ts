export function heatmapChangeClass(changePercent: number): string {
  if (changePercent >= 3) return "bg-emerald-600/90 text-white";
  if (changePercent >= 1) return "bg-emerald-500/75 text-white";
  if (changePercent >= 0.25) return "bg-emerald-500/45 text-foreground";
  if (changePercent > -0.25) return "bg-muted text-muted-foreground";
  if (changePercent > -1) return "bg-rose-500/45 text-foreground";
  if (changePercent > -3) return "bg-rose-500/75 text-white";
  return "bg-rose-600/90 text-white";
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
