import type { MoneyProfile } from "@/types/money-profile";
import { trackUnlocksAllDo } from "@/lib/journey/locks";
import { effectiveKnowledge } from "@/lib/journey/profile";
import { SHOW_THE_DETAILS_LABEL } from "@/lib/journey/first-run";

export { SHOW_THE_DETAILS_LABEL };

/**
 * Beginner invest knowledge (more conservative of self + checks) starts
 * the ticker collapsed. Fast Track / toolsOnly stay full density.
 */
export function tickerStartsCollapsed(
  profile: MoneyProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (trackUnlocksAllDo(profile)) return false;
  const effective = effectiveKnowledge(profile.knowledge, profile.knowledgeChecks);
  return effective.invest === "beginner";
}

/** Beginner add-holding explains each field. Fast / tools skip the extra copy. */
export function explainAddHoldingFields(
  profile: MoneyProfile | null | undefined,
): boolean {
  return tickerStartsCollapsed(profile);
}

export function tickerDensity(
  profile: MoneyProfile | null | undefined,
): "summary" | "full" {
  return tickerStartsCollapsed(profile) ? "summary" : "full";
}
