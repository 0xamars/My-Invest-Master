import {
  BUDGET_PATH,
  FREEDOM_PATH,
  INVEST_PATH,
} from "@/lib/chrome/nav";
import { effectiveKnowledge } from "@/lib/journey/profile";
import type { JourneyPillar, MoneyProfile } from "@/types/money-profile";

export const PILLAR_TABS = ["learn", "do"] as const;
export type PillarTab = (typeof PILLAR_TABS)[number];

const PILLAR_PATH: Record<JourneyPillar, string> = {
  budget: BUDGET_PATH,
  invest: INVEST_PATH,
  freedom: FREEDOM_PATH,
};

export function parsePillarTab(
  raw: string | null | undefined,
): PillarTab | null {
  if (raw === "learn" || raw === "do") return raw;
  return null;
}

export function pillarPath(pillar: JourneyPillar): string {
  return PILLAR_PATH[pillar];
}

export function pillarTabHref(
  pillar: JourneyPillar,
  tab: PillarTab,
  lessonId?: string | null,
): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (tab === "learn" && lessonId) params.set("lesson", lessonId);
  return `${PILLAR_PATH[pillar]}?${params.toString()}`;
}

/**
 * Beginner Track + beginner knowledge for this pillar → Learn.
 * Fast Track / toolsOnly (and non-beginner knowledge) → Do.
 * No profile yet → Do so the existing tool stays the landing.
 */
export function defaultPillarTab(
  profile: MoneyProfile | null,
  pillar: JourneyPillar,
): PillarTab {
  if (!profile) return "do";
  if (profile.track === "fast" || profile.track === "tools") return "do";
  const effective = effectiveKnowledge(
    profile.knowledge,
    profile.knowledgeChecks,
  );
  return effective[pillar] === "beginner" ? "learn" : "do";
}

export function resolvePillarTab(
  rawTab: string | null | undefined,
  profile: MoneyProfile | null,
  pillar: JourneyPillar,
): PillarTab {
  return parsePillarTab(rawTab) ?? defaultPillarTab(profile, pillar);
}

/** Fast Track and toolsOnly collapse Learn to Key ideas. */
export function learnIsCollapsed(profile: MoneyProfile | null): boolean {
  return profile?.track === "fast" || profile?.track === "tools";
}
