import {
  BUDGET_PATH,
  FREEDOM_PATH,
  INVEST_PATH,
} from "@/lib/chrome/nav";
import { effectiveKnowledge } from "@/lib/journey/profile";
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

const STATION_META: Record<
  JourneyPillar,
  { title: JourneyStation["title"]; href: string }
> = {
  budget: { title: "Budget", href: BUDGET_PATH },
  invest: { title: "Invest", href: INVEST_PATH },
  freedom: { title: "Freedom", href: FREEDOM_PATH },
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
    const meta = STATION_META[pillar];
    return {
      pillar,
      title: meta.title,
      href: meta.href,
      status: stationStatus(pillar, profile),
      learnHref: meta.href,
      doHref: meta.href,
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
    href: next.href,
    label: `${verb} ${next.title}`,
  };
}
