import { LEARN_DISCLAIMER } from "@/lib/journey/lessons";
import {
  FIRST_BOOK_FREEDOM_LINE,
  STARTER_SPENDING_ACCOUNT_NAME,
} from "@/lib/journey/first-run";

export const JOURNEY_EDUCATIONAL_FOOTER = LEARN_DISCLAIMER;

export const BUDGET_EMPTY = {
  title: "Start with starter envelopes",
  description: `Housing, Food, Transport, Debt, Fun, and Buffer on one ${STARTER_SPENDING_ACCOUNT_NAME.toLowerCase()} account. Ready to Assign stays empty until you enter money.`,
  kitHref: "/budget",
  learnHref: "/budget",
  kitLabel: "Use these envelopes",
  learnLabel: "Open Budget",
} as const;

export const INVEST_EMPTY_NO_BOOK = {
  title: "Add your investments",
  description: `${FIRST_BOOK_FREEDOM_LINE} No holdings are added until you say so.`,
  learnHref: "/invest",
  learnLabel: "Open Invest",
} as const;

export const INVEST_EMPTY_BOOK = {
  title: "Your portfolio is empty.",
  description:
    "Search still works. Add a public stock when you have one.",
  addLabel: "Add a name",
  learnHref: "/invest",
  learnLabel: "Open Invest",
} as const;

export const FREEDOM_EMPTY = {
  title: "Your budget or investments are missing",
  description:
    "A Retire date needs a budget and your investments. Assign money left to assign in Budget, or add holdings in Invest.",
  leftoverHref: "/budget",
  leftoverLabel: "Assign money left to assign",
  bookHref: "/invest",
  bookLabel: "Open your investments",
  learnHref: "/retire",
  learnLabel: "Open Retire",
} as const;

export const JOURNEY_HOME_EMPTY = {
  leftoverMetric: "Not set up",
  bookMetric: "Not set up",
  freedomLabel: "Not set up",
  leftoverHref: "/budget",
  leftoverLabel: "Assign money left to assign",
  bookHref: "/invest",
  bookLabel: "Open your investments",
} as const;

export const EMPTY_STATE_COPY = [
  BUDGET_EMPTY,
  INVEST_EMPTY_NO_BOOK,
  INVEST_EMPTY_BOOK,
  FREEDOM_EMPTY,
  JOURNEY_HOME_EMPTY,
] as const;

export function emptyStateCopyText(): string {
  return JSON.stringify(EMPTY_STATE_COPY);
}
