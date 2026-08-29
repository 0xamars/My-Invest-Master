import type { JourneyPillar, MoneyProfile } from "@/types/money-profile";
import { isLessonComplete } from "@/lib/journey/profile";
import { lessonsForPillar } from "@/lib/journey/lessons";

export const INVEST_DO_SKIP_WARNING =
  "Leftover and the book will not stay in sync if you skip Budget.";

export function trackUnlocksAllDo(
  profile: Pick<MoneyProfile, "track"> | null | undefined,
): boolean {
  return profile?.track === "fast" || profile?.track === "tools";
}

/**
 * Beginner Invest Do is locked until Budget is working, they confirm they
 * budget elsewhere, or they already have a book (never hide an existing book).
 * Fast Track / toolsOnly: all Do unlocked.
 */
export function investDoIsLocked(input: {
  profile: MoneyProfile | null | undefined;
  hasBook: boolean;
}): boolean {
  const { profile, hasBook } = input;
  if (!profile) return false;
  if (trackUnlocksAllDo(profile)) return false;
  if (profile.working.budget || profile.flags.budgetElsewhere) return false;
  if (hasBook) return false;
  return true;
}

export function confirmBudgetElsewhere(profile: MoneyProfile): MoneyProfile {
  return {
    ...profile,
    flags: { ...profile.flags, budgetElsewhere: true },
  };
}

/**
 * Beginner Track must confirm before using Options. Fast / tools skip.
 * Does not delete Options.
 */
export function optionsIsGated(
  profile: MoneyProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (trackUnlocksAllDo(profile)) return false;
  return profile.flags.optionsConfirmed !== true;
}

export function confirmOptionsUse(profile: MoneyProfile): MoneyProfile {
  return {
    ...profile,
    flags: { ...profile.flags, optionsConfirmed: true },
  };
}

export function pillarHasCompletedLesson(
  profile: Pick<MoneyProfile, "completedLessons">,
  pillar: JourneyPillar,
): boolean {
  return lessonsForPillar(pillar).some((lesson) =>
    isLessonComplete(profile, lesson.id),
  );
}
