import budgetLearn from "@/content/learn/budget.json";
import freedomLearn from "@/content/learn/freedom.json";
import investLearn from "@/content/learn/invest.json";
import type { JourneyPillar } from "@/types/money-profile";

export const LEARN_DISCLAIMER =
  "Educational. Not financial advice. You can lose money.";

export type LearnCheckOption = {
  id: string;
  label: string;
};

export type LearnCheck = {
  id: string;
  prompt: string;
  options: readonly LearnCheckOption[];
  correctId: string;
};

export type LearnCta = {
  label: string;
  href: string;
};

export type LearnLesson = {
  id: string;
  title: string;
  keyIdea: string;
  paragraphs: readonly string[];
  cta: LearnCta;
  checks?: readonly LearnCheck[];
};

export type LearnPillarCatalog = {
  pillar: JourneyPillar;
  lessons: readonly LearnLesson[];
};

const CATALOG: Record<JourneyPillar, LearnPillarCatalog> = {
  budget: budgetLearn as LearnPillarCatalog,
  invest: investLearn as LearnPillarCatalog,
  freedom: freedomLearn as LearnPillarCatalog,
};

export const LEARN_CATALOG = CATALOG;

export const LESSON_IDS: readonly string[] = (
  Object.values(CATALOG) as LearnPillarCatalog[]
).flatMap((pillar) => pillar.lessons.map((lesson) => lesson.id));

const LESSON_ID_SET = new Set(LESSON_IDS);

export function isLessonId(value: string): boolean {
  return LESSON_ID_SET.has(value);
}

export function lessonsForPillar(pillar: JourneyPillar): readonly LearnLesson[] {
  return CATALOG[pillar].lessons;
}

export function lessonById(id: string): LearnLesson | undefined {
  for (const pillar of Object.values(CATALOG) as LearnPillarCatalog[]) {
    const match = pillar.lessons.find((lesson) => lesson.id === id);
    if (match) return match;
  }
  return undefined;
}

export function parseLessonId(
  raw: string | null | undefined,
  pillar: JourneyPillar,
): string | null {
  if (!raw || !isLessonId(raw)) return null;
  const belongs = CATALOG[pillar].lessons.some((lesson) => lesson.id === raw);
  return belongs ? raw : null;
}
