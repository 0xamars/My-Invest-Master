import {
  BUDGET_PATH,
  INVEST_PATH,
  RETIRE_PATH,
} from "@/lib/chrome/nav";
import type { JourneyPillar, MoneyProfile } from "@/types/money-profile";

export const PILLAR_TABS = ["learn", "do"] as const;
export type PillarTab = (typeof PILLAR_TABS)[number];

const PILLAR_PATH: Record<JourneyPillar, string> = {
  budget: BUDGET_PATH,
  invest: INVEST_PATH,
  freedom: RETIRE_PATH,
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
  _tab?: PillarTab,
  _lessonId?: string | null,
): string {
  return PILLAR_PATH[pillar];
}

/** Learn/Do tabs are unshipped. Pillar hubs open the tool. */
export function defaultPillarTab(
  _profile: MoneyProfile | null,
  _pillar: JourneyPillar,
): PillarTab {
  return "do";
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
