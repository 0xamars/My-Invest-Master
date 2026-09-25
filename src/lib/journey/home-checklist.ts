import { BUDGET_PATH, INVEST_PATH, RETIRE_PATH } from "@/lib/chrome/nav";

export const HOME_CHECKLIST_TITLE = "First steps";

export const HOME_CHECKLIST_NOTE =
  "Three moves. Nothing here invents leftover, holdings, or a Retire date.";

const STEPS = [
  { id: "budget", label: "Create a budget", href: BUDGET_PATH },
  { id: "book", label: "Name the book", href: INVEST_PATH },
  { id: "retire", label: "Start Retire", href: RETIRE_PATH },
] as const;

export type HomeChecklistId = (typeof STEPS)[number]["id"];

export type HomeChecklistItem = {
  id: HomeChecklistId;
  label: string;
  href: string;
  done: boolean;
};

/**
 * Signed-in first run only. The card goes away once budget, book, and a
 * Retire plan all exist. Done means the record exists — not a guessed balance.
 */
export function buildHomeChecklist(input: {
  hasBudget: boolean;
  hasBook: boolean;
  hasRetirePlan: boolean;
}): HomeChecklistItem[] | null {
  const done: Record<HomeChecklistId, boolean> = {
    budget: input.hasBudget,
    book: input.hasBook,
    retire: input.hasRetirePlan,
  };
  if (STEPS.every((step) => done[step.id])) return null;
  return STEPS.map((step) => ({
    id: step.id,
    label: step.label,
    href: step.href,
    done: done[step.id],
  }));
}
