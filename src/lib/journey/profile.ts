import {
  isDisplayCurrency,
  type DisplayCurrency,
} from "@/types/currency";
import {
  DEFAULT_MONEY_PROFILE_COUNTRY,
  DEFAULT_MONEY_PROFILE_CURRENCY,
  INCOME_CADENCES,
  JOURNEY_PILLARS,
  KNOWLEDGE_LEVELS,
  PRIMARY_GOALS,
  RISK_BANDS,
  WORK_STATUSES,
  type IncomeCadence,
  type JourneyPillar,
  type JourneyTrack,
  type KnowledgeByPillar,
  type KnowledgeCheckId,
  type KnowledgeChecks,
  type CompletedLessons,
  type KnowledgeLevel,
  type MoneyProfile,
  type MoneyProfileFlags,
  type MoneyProfileWorking,
  type PrimaryGoal,
  type RiskBand,
  type WorkStatus,
} from "@/types/money-profile";
import { KNOWLEDGE_CHECKS, knowledgeFromChecks } from "@/lib/journey/checks";
import { isLessonId } from "@/lib/journey/lessons";

const KNOWLEDGE_RANK: Record<KnowledgeLevel, number> = {
  beginner: 0,
  intermediate: 1,
  confident: 2,
};

export const COUNTRY_CURRENCY: Record<string, DisplayCurrency> = {
  CA: "CAD",
  US: "USD",
  GB: "GBP",
  AU: "AUD",
  NZ: "NZD",
  IE: "EUR",
  DE: "EUR",
  FR: "EUR",
  NL: "EUR",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  JP: "JPY",
  SG: "SGD",
  IN: "INR",
  MX: "MXN",
  BR: "BRL",
  ZA: "ZAR",
};

export const MONEY_PROFILE_COUNTRIES = [
  { code: "CA", name: "Canada" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "IN", name: "India" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "ZA", name: "South Africa" },
  { code: "OTHER", name: "Somewhere else" },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKnowledgeLevel(value: unknown): value is KnowledgeLevel {
  return (KNOWLEDGE_LEVELS as readonly string[]).includes(value as string);
}

export function parseKnowledgeLevel(
  value: unknown,
  fallback: KnowledgeLevel = "beginner",
): KnowledgeLevel {
  if (value === "comfortable") return "confident";
  if (isKnowledgeLevel(value)) return value;
  return fallback;
}

function moreConservative(
  self: KnowledgeLevel,
  fromChecks: KnowledgeLevel,
): KnowledgeLevel {
  return KNOWLEDGE_RANK[self] <= KNOWLEDGE_RANK[fromChecks] ? self : fromChecks;
}

export function effectiveKnowledge(
  self: KnowledgeByPillar,
  checks: KnowledgeChecks,
): KnowledgeByPillar {
  return {
    budget: moreConservative(self.budget, knowledgeFromChecks("budget", checks)),
    invest: moreConservative(self.invest, knowledgeFromChecks("invest", checks)),
    freedom: moreConservative(
      self.freedom,
      knowledgeFromChecks("freedom", checks),
    ),
  };
}

export function computeTrack(
  knowledge: KnowledgeByPillar,
  flags: MoneyProfileFlags,
): JourneyTrack {
  if (flags.toolsOnly) return "tools";
  const allConfident = JOURNEY_PILLARS.every(
    (pillar) => knowledge[pillar] === "confident",
  );
  return allConfident ? "fast" : "beginner";
}

function parseCountry(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_MONEY_PROFILE_COUNTRY;
  }
  const code = value.trim().toUpperCase();
  if (MONEY_PROFILE_COUNTRIES.some((country) => country.code === code)) {
    return code;
  }
  return DEFAULT_MONEY_PROFILE_COUNTRY;
}

function parseCurrency(
  value: unknown,
  country: string,
): DisplayCurrency {
  if (typeof value === "string" && isDisplayCurrency(value)) return value;
  return COUNTRY_CURRENCY[country] ?? DEFAULT_MONEY_PROFILE_CURRENCY;
}

function parseOptionalAge(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const age = Math.round(n);
  if (age < 0 || age > 120) return null;
  return age;
}

function parseWorkStatus(value: unknown): WorkStatus | null {
  if (typeof value !== "string") return null;
  return (WORK_STATUSES as readonly string[]).includes(value)
    ? (value as WorkStatus)
    : null;
}

function parseIncomeCadence(value: unknown): IncomeCadence | null {
  if (typeof value !== "string") return null;
  return (INCOME_CADENCES as readonly string[]).includes(value)
    ? (value as IncomeCadence)
    : null;
}

function parseOptionalAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseKnowledge(raw: unknown): KnowledgeByPillar {
  const record = isRecord(raw) ? raw : {};
  return {
    budget: parseKnowledgeLevel(record.budget),
    invest: parseKnowledgeLevel(record.invest),
    freedom: parseKnowledgeLevel(record.freedom),
  };
}

function parseKnowledgeChecks(raw: unknown): KnowledgeChecks {
  if (!isRecord(raw)) return {};
  const next: KnowledgeChecks = {};
  for (const check of KNOWLEDGE_CHECKS) {
    const value = raw[check.id];
    if (typeof value === "string" && value.length > 0) {
      next[check.id] = value;
    }
  }
  return next;
}

function parseFlags(raw: unknown): MoneyProfileFlags {
  const record = isRecord(raw) ? raw : {};
  return {
    budgetElsewhere: record.budgetElsewhere === true,
    investNoHoldingsYet: record.investNoHoldingsYet === true,
    toolsOnly: record.toolsOnly === true,
    optionsConfirmed: record.optionsConfirmed === true,
  };
}

function parseWorking(raw: unknown): MoneyProfileWorking {
  const record = isRecord(raw) ? raw : {};
  return {
    budget: record.budget === true,
    invest: record.invest === true,
    freedom: record.freedom === true,
  };
}

function parseCompletedLessons(raw: unknown): CompletedLessons {
  if (!isRecord(raw)) return {};
  const next: CompletedLessons = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isLessonId(key) && value === true) {
      next[key] = true;
    }
  }
  return next;
}

export function isLessonComplete(
  profile: Pick<MoneyProfile, "completedLessons"> | null | undefined,
  lessonId: string,
): boolean {
  return profile?.completedLessons[lessonId] === true;
}

export function markLessonComplete(
  profile: MoneyProfile,
  lessonId: string,
): MoneyProfile {
  if (!isLessonId(lessonId)) return normalizeMoneyProfile(profile);
  return normalizeMoneyProfile({
    ...profile,
    completedLessons: { ...profile.completedLessons, [lessonId]: true },
  });
}

function parseRiskBand(value: unknown): RiskBand {
  return (RISK_BANDS as readonly string[]).includes(value as string)
    ? (value as RiskBand)
    : "balanced";
}

function parsePrimaryGoal(value: unknown): PrimaryGoal {
  return (PRIMARY_GOALS as readonly string[]).includes(value as string)
    ? (value as PrimaryGoal)
    : "unsure";
}

export function defaultMoneyProfileDraft(): MoneyProfile {
  return {
    country: DEFAULT_MONEY_PROFILE_COUNTRY,
    currency: DEFAULT_MONEY_PROFILE_CURRENCY,
    age: null,
    workStatus: null,
    incomeCadence: null,
    incomeAmount: null,
    knowledge: {
      budget: "beginner",
      invest: "beginner",
      freedom: "beginner",
    },
    knowledgeChecks: {},
    riskBand: "balanced",
    primaryGoal: "unsure",
    flags: {
      budgetElsewhere: false,
      investNoHoldingsYet: false,
      toolsOnly: false,
      optionsConfirmed: false,
    },
    working: {
      budget: false,
      invest: false,
      freedom: false,
    },
    track: "beginner",
    completedLessons: {},
  };
}

/**
 * Normalize stored JSON. Recomputes effective knowledge and track.
 * Working flags stay as last persisted — live leftover / book / Freedom plan
 * are applied by deriveWorkingFlags, then saved when they change.
 * Income and age stay optional; never invented.
 */
export function normalizeMoneyProfile(raw: unknown): MoneyProfile {
  const record = isRecord(raw) ? raw : {};
  const country = parseCountry(record.country);
  const currency = parseCurrency(record.currency, country);
  const knowledge = parseKnowledge(record.knowledge);
  const knowledgeChecks = parseKnowledgeChecks(record.knowledgeChecks);
  const flags = parseFlags(record.flags);
  const working = parseWorking(record.working);
  const completedLessons = parseCompletedLessons(record.completedLessons);
  const effective = effectiveKnowledge(knowledge, knowledgeChecks);

  return {
    country,
    currency,
    age: parseOptionalAge(record.age),
    workStatus: parseWorkStatus(record.workStatus),
    incomeCadence: parseIncomeCadence(record.incomeCadence),
    incomeAmount: parseOptionalAmount(record.incomeAmount),
    knowledge,
    knowledgeChecks,
    riskBand: parseRiskBand(record.riskBand),
    primaryGoal: parsePrimaryGoal(record.primaryGoal),
    flags,
    working,
    track: computeTrack(effective, flags),
    completedLessons,
  };
}

export function situationIsComplete(profile: Pick<MoneyProfile, "country" | "currency">): boolean {
  return profile.country.trim().length > 0 && isDisplayCurrency(profile.currency);
}

export function knowledgeStepIsComplete(profile: MoneyProfile): boolean {
  return JOURNEY_PILLARS.every((pillar: JourneyPillar) =>
    isKnowledgeLevel(profile.knowledge[pillar]),
  ) && KNOWLEDGE_CHECKS.every((check) => {
    const answer = profile.knowledgeChecks[check.id as KnowledgeCheckId];
    return typeof answer === "string" && answer.length > 0;
  });
}

export function goalStepIsComplete(profile: MoneyProfile): boolean {
  return (
    (RISK_BANDS as readonly string[]).includes(profile.riskBand) &&
    (PRIMARY_GOALS as readonly string[]).includes(profile.primaryGoal)
  );
}

export function finalizeMoneyProfile(draft: MoneyProfile): MoneyProfile {
  return normalizeMoneyProfile(draft);
}
