"use client";

import { scoreBarFillStyle } from "@/lib/analysis/rating/tech-palette";
import { cn } from "@/lib/utils";

/**
 * Unified 0–100 score bar for Fundamental pillars and Technical rows.
 * Fill width = score/100; color from discrete score-band tokens.
 */
export function ScoreBar({
  score,
  available = true,
  className,
}: {
  score: number | null | undefined;
  available?: boolean;
  className?: string;
}) {
  if (!available || score == null) {
    return (
      <div
        className={cn(
          "h-1.5 overflow-hidden rounded-full bg-muted/40",
          className,
        )}
        aria-hidden
      />
    );
  }

  const width = Math.min(100, Math.max(0, score));
  return (
    <div
      className={cn(
        "h-1.5 overflow-hidden rounded-full bg-muted/60",
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-[width,background-color]"
        style={{ width: `${width}%`, ...scoreBarFillStyle(score) }}
      />
    </div>
  );
}
