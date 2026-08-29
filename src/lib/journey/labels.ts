import type {
  JourneyTrack,
  KnowledgeLevel,
  PrimaryGoal,
  RiskBand,
  StationStatus,
  WorkStatus,
} from "@/types/money-profile";

export const GOAL_LABELS: Record<PrimaryGoal, string> = {
  cashflow: "Cash flow",
  cushion: "Build a cushion",
  start_investing: "Start investing",
  retire_year: "A freedom year",
  unsure: "Still figuring it out",
};

export const TRACK_LABELS: Record<JourneyTrack, string> = {
  beginner: "Beginner Track",
  fast: "Fast Track",
  tools: "Tools only",
};

export const RISK_LABELS: Record<RiskBand, string> = {
  preserve: "Preserve",
  balanced: "Balanced",
  growth: "Growth",
};

export const KNOWLEDGE_LABELS: Record<KnowledgeLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  confident: "Confident",
};

export const STATION_STATUS_LABELS: Record<StationStatus, string> = {
  locked: "Locked",
  learn: "Learn",
  in_progress: "In progress",
  working: "Working",
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  employed: "Employed",
  self_employed: "Self-employed",
  student: "Student",
  retired: "Retired",
  between_jobs: "Between jobs",
  other: "Other",
};

export function profileSummaryLine(input: {
  primaryGoal: PrimaryGoal;
  track: JourneyTrack;
  riskBand: RiskBand;
}): string {
  return `${GOAL_LABELS[input.primaryGoal]} · ${TRACK_LABELS[input.track]} · ${RISK_LABELS[input.riskBand]}`;
}
