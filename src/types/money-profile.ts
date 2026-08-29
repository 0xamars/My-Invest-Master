import type { DisplayCurrency } from "@/types/currency";

export const KNOWLEDGE_LEVELS = [
  "beginner",
  "intermediate",
  "confident",
] as const;
export type KnowledgeLevel = (typeof KNOWLEDGE_LEVELS)[number];

export const JOURNEY_PILLARS = ["budget", "invest", "freedom"] as const;
export type JourneyPillar = (typeof JOURNEY_PILLARS)[number];

export const RISK_BANDS = ["preserve", "balanced", "growth"] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

export const PRIMARY_GOALS = [
  "cashflow",
  "cushion",
  "start_investing",
  "retire_year",
  "unsure",
] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

export const JOURNEY_TRACKS = ["beginner", "fast", "tools"] as const;
export type JourneyTrack = (typeof JOURNEY_TRACKS)[number];

export const WORK_STATUSES = [
  "employed",
  "self_employed",
  "student",
  "retired",
  "between_jobs",
  "other",
] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const INCOME_CADENCES = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "yearly",
] as const;
export type IncomeCadence = (typeof INCOME_CADENCES)[number];

export const STATION_STATUSES = [
  "locked",
  "learn",
  "in_progress",
  "working",
] as const;
export type StationStatus = (typeof STATION_STATUSES)[number];

export const KNOWLEDGE_CHECK_IDS = [
  "budget_leftover",
  "budget_month_close",
  "invest_avg_cost",
  "invest_book",
  "freedom_date_source",
  "freedom_missing",
] as const;
export type KnowledgeCheckId = (typeof KNOWLEDGE_CHECK_IDS)[number];

export type KnowledgeByPillar = Record<JourneyPillar, KnowledgeLevel>;
export type KnowledgeChecks = Partial<Record<KnowledgeCheckId, string>>;

export interface MoneyProfileFlags {
  budgetElsewhere: boolean;
  investNoHoldingsYet: boolean;
  toolsOnly: boolean;
}

export interface MoneyProfileWorking {
  budget: boolean;
  invest: boolean;
  freedom: boolean;
}

export interface MoneyProfile {
  country: string;
  currency: DisplayCurrency;
  age: number | null;
  workStatus: WorkStatus | null;
  incomeCadence: IncomeCadence | null;
  incomeAmount: number | null;
  knowledge: KnowledgeByPillar;
  knowledgeChecks: KnowledgeChecks;
  riskBand: RiskBand;
  primaryGoal: PrimaryGoal;
  flags: MoneyProfileFlags;
  working: MoneyProfileWorking;
  track: JourneyTrack;
}

export const DEFAULT_MONEY_PROFILE_COUNTRY = "CA";
export const DEFAULT_MONEY_PROFILE_CURRENCY: DisplayCurrency = "CAD";
