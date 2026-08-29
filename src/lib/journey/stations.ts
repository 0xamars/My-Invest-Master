import { investDoIsLocked, pillarHasCompletedLesson } from "@/lib/journey/locks";
import { effectiveKnowledge } from "@/lib/journey/profile";
import { pillarPath, pillarTabHref } from "@/lib/journey/tabs";
import {
  JOURNEY_PILLARS,
  type JourneyPillar,
  type MoneyProfile,
  type StationStatus,
} from "@/types/money-profile";

export type JourneyStation = {
  pillar: JourneyPillar;
  title: "Budget" | "Invest" | "Freedom";
  href: string;
  status: StationStatus;
  learnHref: string;
  doHref: string;
};

export type JourneyNextAction = {
  pillar: JourneyPillar;
  href: string;
  label: string;
};

const STATION_TITLE: Record<JourneyPillar, JourneyStation["title"]> = {
  budget: "Budget",
  invest: "Invest",
  freedom: "Freedom",
};

export type JourneyLiveHints = {
  /** Live primary book. An existing book is never hidden behind the Invest lock. */
  hasBook?: boolean;
};

/**
 * Locked | Learn | In progress | Working from real working flags,
 * completed lessons, and the Invest soft lock.
 */
export function stationStatus(
  pillar: JourneyPillar,
  profile: MoneyProfile,
  live: JourneyLiveHints = {},
): StationStatus {
  if (
    pillar === "invest" &&
    investDoIsLocked({ profile, hasBook: live.hasBook === true })
  ) {
    return "locked";
  }
  if (profile.working[pillar]) return "working";
  if (profile.track === "tools") return "in_progress";
  if (pillarHasCompletedLesson(profile, pillar)) return "in_progress";
  const effective = effectiveKnowledge(
    profile.knowledge,
    profile.knowledgeChecks,
  );
  if (effective[pillar] === "beginner") return "learn";
  return "in_progress";
}

export function journeyStations(
  profile: MoneyProfile,
  live: JourneyLiveHints = {},
): JourneyStation[] {
  return JOURNEY_PILLARS.map((pillar) => {
    const href = pillarPath(pillar);
    return {
      pillar,
      title: STATION_TITLE[pillar],
      href,
      status: stationStatus(pillar, profile, live),
      learnHref: pillarTabHref(pillar, "learn"),
      doHref: pillarTabHref(pillar, "do"),
    };
  });
}

export function primaryNextAction(
  profile: MoneyProfile,
  live: JourneyLiveHints = {},
): JourneyNextAction {
  const stations = journeyStations(profile, live);
  const next =
    stations.find((station) => station.status !== "working") ?? stations[0];
  if (next.status === "locked") {
    return {
      pillar: next.pillar,
      href: next.learnHref,
      label: `Learn ${next.title}`,
    };
  }
  const verb = next.status === "learn" ? "Learn" : "Open";
  return {
    pillar: next.pillar,
    href: next.status === "learn" ? next.learnHref : next.doHref,
    label: `${verb} ${next.title}`,
  };
}
