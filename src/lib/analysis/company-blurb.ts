const ABBREV_PLACEHOLDER = "\u0000";

const META_LINE_RE =
  /\b(investsalsa|provides insights|this analysis|insights into companies)\b/i;

const ADVICE_RE =
  /\b(buy|sell|hold|overweight|underweight|price target|strong buy)\b/i;

function protectAbbreviations(text: string): string {
  return text.replace(
    /\b(Inc|Ltd|LLC|Corp|Co|Jr|Sr|U\.S|U\.K|e\.g|i\.e)\./gi,
    (m) => `${m.slice(0, -1)}${ABBREV_PLACEHOLDER}`,
  );
}

function restoreAbbreviations(text: string): string {
  return text.split(ABBREV_PLACEHOLDER).join(".");
}

export function splitSentences(text: string): string[] {
  const protectedText = protectAbbreviations(text.replace(/\s+/g, " ").trim());
  if (!protectedText) return [];
  const parts = (protectedText.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [])
    .map((s) => restoreAbbreviations(s).trim())
    .filter(Boolean);
  return parts;
}

export function stripMetaPrefix(text: string): string {
  const sentences = splitSentences(text);
  const kept = sentences.filter((s) => !META_LINE_RE.test(s));
  return kept.join(" ").trim();
}

export function isRejectedBlurb(text: string | null | undefined): boolean {
  if (!text) return true;
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 40) return true;
  if (META_LINE_RE.test(t)) return true;
  if (ADVICE_RE.test(t)) return true;
  return false;
}

/** First 1–2 profile sentences; drop InvestSalsa/meta lead-ins. */
export function truncateProfileDescription(
  text: string | null | undefined,
  maxChars = 420,
): string | null {
  if (!text) return null;
  const cleaned = stripMetaPrefix(text.replace(/\s+/g, " ").trim());
  if (!cleaned) return null;
  const sentences = splitSentences(cleaned).slice(0, 2);
  let out = sentences.join(" ").trim();
  if (!out) return null;
  if (out.length > maxChars) {
    const slice = out.slice(0, maxChars);
    const lastSpace = slice.lastIndexOf(" ");
    out = `${(lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trim()}…`;
  }
  return out;
}

export function finalizeCompanyBlurb(
  aiText: string | null | undefined,
  fallback: string | null,
): { blurb: string | null; source: "ai" | "fallback"; rejected: boolean } {
  const stripped = aiText ? stripMetaPrefix(aiText.replace(/\s+/g, " ").trim()) : "";
  if (stripped && !isRejectedBlurb(stripped)) {
    return { blurb: stripped, source: "ai", rejected: false };
  }
  return {
    blurb: fallback,
    source: "fallback",
    rejected: Boolean(aiText?.trim()),
  };
}
