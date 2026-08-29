import type {
  JourneyPillar,
  KnowledgeCheckId,
  KnowledgeChecks,
  KnowledgeLevel,
} from "@/types/money-profile";
import { KNOWLEDGE_CHECK_IDS } from "@/types/money-profile";

export type KnowledgeCheckOption = {
  id: string;
  label: string;
};

export type KnowledgeCheck = {
  id: KnowledgeCheckId;
  pillar: JourneyPillar;
  prompt: string;
  options: readonly KnowledgeCheckOption[];
  correctId: string;
};

export const KNOWLEDGE_CHECKS: readonly KnowledgeCheck[] = [
  {
    id: "budget_leftover",
    pillar: "budget",
    prompt: "Leftover (Ready to Assign) is…",
    options: [
      { id: "assigned", label: "Money already given a job" },
      { id: "unassigned", label: "Money not yet given a job" },
      { id: "spend", label: "Extra income you can spend" },
    ],
    correctId: "unassigned",
  },
  {
    id: "budget_month_close",
    pillar: "budget",
    prompt: "Closing a month…",
    options: [
      { id: "carry", label: "Carries leftover forward" },
      { id: "zero", label: "Starts you at zero" },
      { id: "delete", label: "Deletes last month" },
    ],
    correctId: "carry",
  },
  {
    id: "invest_avg_cost",
    pillar: "invest",
    prompt: "Average cost is…",
    options: [
      { id: "paid", label: "What you paid per share, on average" },
      { id: "today", label: "Today’s price" },
      { id: "target", label: "A target you hope to hit" },
    ],
    correctId: "paid",
  },
  {
    id: "invest_book",
    pillar: "invest",
    prompt: "The Invest book shows…",
    options: [
      { id: "qty", label: "Quantity, average cost, and P/L" },
      { id: "rating", label: "A buy or sell rating" },
      { id: "return", label: "Next year’s return" },
    ],
    correctId: "qty",
  },
  {
    id: "freedom_date_source",
    pillar: "freedom",
    prompt: "A Freedom date here comes from…",
    options: [
      { id: "leftover_book", label: "Leftover and the book" },
      { id: "times_twelve", label: "Leftover × 12 as yearly savings" },
      { id: "guess", label: "An AI guess" },
    ],
    correctId: "leftover_book",
  },
  {
    id: "freedom_missing",
    pillar: "freedom",
    prompt: "If leftover or the book is missing…",
    options: [
      { id: "unknown", label: "The date is unknown" },
      { id: "invent", label: "We invent a date" },
      { id: "last_year", label: "We reuse last year’s numbers" },
    ],
    correctId: "unknown",
  },
] as const;

const CHECKS_BY_ID = new Map(
  KNOWLEDGE_CHECKS.map((check) => [check.id, check]),
);

export function knowledgeCheckById(
  id: KnowledgeCheckId,
): KnowledgeCheck | undefined {
  return CHECKS_BY_ID.get(id);
}

export function isKnowledgeCheckId(value: string): value is KnowledgeCheckId {
  return (KNOWLEDGE_CHECK_IDS as readonly string[]).includes(value);
}

export function checksForPillar(pillar: JourneyPillar): KnowledgeCheck[] {
  return KNOWLEDGE_CHECKS.filter((check) => check.pillar === pillar);
}

export function correctCheckCount(
  pillar: JourneyPillar,
  answers: KnowledgeChecks,
): number {
  return checksForPillar(pillar).filter(
    (check) => answers[check.id] === check.correctId,
  ).length;
}

/** 0 correct → beginner, 1 → intermediate, 2 → confident. */
export function knowledgeFromChecks(
  pillar: JourneyPillar,
  answers: KnowledgeChecks,
): KnowledgeLevel {
  const score = correctCheckCount(pillar, answers);
  if (score >= 2) return "confident";
  if (score === 1) return "intermediate";
  return "beginner";
}

export function allChecksAnswered(answers: KnowledgeChecks): boolean {
  return KNOWLEDGE_CHECKS.every((check) => {
    const value = answers[check.id];
    return typeof value === "string" && value.length > 0;
  });
}
