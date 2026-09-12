import type { MoneyProfile } from "@/types/money-profile";
import { SHOW_THE_DETAILS_LABEL } from "@/lib/journey/first-run";

export { SHOW_THE_DETAILS_LABEL };

/**
 * Beginner invest knowledge (more conservative of self + checks) starts
 * the ticker collapsed. Fast Track / toolsOnly stay full density.
 */
export function tickerStartsCollapsed(
  _profile: MoneyProfile | null | undefined,
): boolean {
  return false;
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
