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

/**
 * Slice A: derived-light only. Working flags are stored, not live.
 * Soft locks (Locked) arrive in Slice C — unused here.
 */
export function stationStatus(
  pillar: JourneyPillar,
  profile: MoneyProfile,
): StationStatus {
  if (profile.working[pillar]) return "working";
  if (profile.track === "tools") return "in_progress";
  const effective = effectiveKnowledge(
    profile.knowledge,
    profile.knowledgeChecks,
  );
  if (effective[pillar] === "beginner") return "learn";
  return "in_progress";
}

export function journeyStations(profile: MoneyProfile): JourneyStation[] {
  return JOURNEY_PILLARS.map((pillar) => {
    const href = pillarPath(pillar);
    return {
      pillar,
      title: STATION_TITLE[pillar],
      href,
      status: stationStatus(pillar, profile),
      learnHref: pillarTabHref(pillar, "learn"),
      doHref: pillarTabHref(pillar, "do"),
    };
  });
}

export function primaryNextAction(profile: MoneyProfile): JourneyNextAction {
  const stations = journeyStations(profile);
  const next =
    stations.find((station) => station.status !== "working") ?? stations[0];
  const verb = next.status === "learn" ? "Learn" : "Open";
  return {
    pillar: next.pillar,
    href: next.status === "learn" ? next.learnHref : next.doHref,
    label: `${verb} ${next.title}`,
  };
}
