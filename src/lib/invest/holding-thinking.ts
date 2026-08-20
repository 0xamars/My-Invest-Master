import { holdingExpandHasRatingUi } from "@/lib/portfolio/holding-expand";

const ADVICE_RE =
  /\b(buy more|buy|sell|hold|trim|add|overweight|underweight|price target|strong buy)\b/i;
const BANNED_RE = /\b(ynab|claude|shopping list|peers?|scoreboard)\b/i;
const SCORE_RE = /\b0\s*[–-]\s*100\b|\bscore\b|\brating\b/i;

export function sanitizeHoldingThinking(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 24 || cleaned.length > 900) return null;
  if (holdingExpandHasRatingUi(cleaned)) return null;
  if (ADVICE_RE.test(cleaned)) return null;
  if (BANNED_RE.test(cleaned)) return null;
  if (SCORE_RE.test(cleaned)) return null;
  return cleaned;
}

export function thinkingCacheDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
