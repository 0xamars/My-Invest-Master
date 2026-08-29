import type { LeftoverPresence } from "@/lib/invest/leftover";
import {
  bindFreedomPathPlan,
  type BookPresence,
  findFreedomCrossing,
  formatFreedomDate,
} from "@/lib/retirement/freedom-path";
import { createEmptyPlan, type RetirementPlan } from "@/types/retirement";

export const FREEDOM_DATE_NEEDS_INPUTS = "Needs leftover and a book";

export type JourneyFreedomDate =
  | { status: "needs-inputs"; label: typeof FREEDOM_DATE_NEEDS_INPUTS }
  | { status: "ready"; year: number | null; label: string };

/**
 * Journey Home Freedom widget. Uses the existing leftover + book path only.
 * Missing leftover or book is labeled — never a guessed date, never leftover × 12.
 */
export function journeyFreedomDate(input: {
  leftover: LeftoverPresence;
  book: BookPresence;
  assumptions?: RetirementPlan | null;
  currentYear?: number;
}): JourneyFreedomDate {
  if (input.leftover.status !== "present" || input.book.status !== "present") {
    return { status: "needs-inputs", label: FREEDOM_DATE_NEEDS_INPUTS };
  }

  const currentYear = input.currentYear ?? new Date().getFullYear();
  const assumptions = input.assumptions ?? createEmptyPlan("Freedom");
  const path = bindFreedomPathPlan(assumptions, input.leftover, input.book);
  const crossing = findFreedomCrossing(path, { currentYear });

  return {
    status: "ready",
    year: crossing?.year ?? null,
    label: formatFreedomDate(crossing, currentYear),
  };
}
