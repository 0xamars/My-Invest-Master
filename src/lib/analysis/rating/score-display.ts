/**
 * User-facing score display: engine stays 0–100; UI shows 0–10.
 * Half-up to 1 decimal (e.g. 85.5 → 8.6). Null → "—".
 */

/** Convert internal 0–100 score to display 0–10 (1 decimal, half-up). */
export function scoreToTen(
  score100: number | null | undefined,
): number | null {
  if (score100 == null || !Number.isFinite(score100)) return null;
  const rounded = Math.round((score100 / 10) * 10) / 10;
  if (!Number.isFinite(rounded)) return null;
  return Math.min(10, Math.max(0, rounded));
}

/** Format for UI — always one decimal, or em dash when unavailable. */
export function formatScore10(
  score100: number | null | undefined,
): string {
  const ten = scoreToTen(score100);
  if (ten == null) return "—";
  return ten.toFixed(1);
}
