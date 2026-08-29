import { LEARN_DISCLAIMER } from "@/lib/journey/lessons";
import { FREEDOM_DATE_NEEDS_INPUTS } from "@/lib/journey/freedom-date";
import {
  FIRST_BOOK_FREEDOM_LINE,
  STARTER_ENVELOPE_NAMES,
  STARTER_SPENDING_ACCOUNT_NAME,
} from "@/lib/journey/first-run";

export const JOURNEY_EDUCATIONAL_FOOTER = LEARN_DISCLAIMER;

export const BUDGET_EMPTY = {
  title: "Start with starter envelopes",
  description: `Housing, Food, Transport, Debt, Fun, and Buffer on one ${STARTER_SPENDING_ACCOUNT_NAME.toLowerCase()} account. Leftover and month close stay empty until you enter them.`,
  kitHref: "/budget?tab=do",
  learnHref: "/budget?tab=learn",
  kitLabel: "Use these envelopes",
  learnLabel: "Learn Budget",
} as const;

export const INVEST_EMPTY_NO_BOOK = {
  title: "Name the book",
  description: `${FIRST_BOOK_FREEDOM_LINE} No holdings are added until you say so.`,
  learnHref: "/invest?tab=learn",
  learnLabel: "Learn Invest",
} as const;

export const INVEST_EMPTY_BOOK = {
  title: "The book is empty.",
  description:
    "This book stays. Search still works. Add a public stock when you have one, or open Learn. Missing cache prints Unknown. No holdings are invented.",
  addLabel: "Add a name",
  learnHref: "/invest?tab=learn",
  learnLabel: "Learn Invest",
} as const;

export const FREEDOM_EMPTY = {
  title: "Leftover and the book are missing",
  description:
    "A Freedom date needs leftover and the book. This page will not invent cash, holdings, or a year. Assign leftover in Budget, name the book in Invest, or open Learn.",
  leftoverHref: "/budget?tab=do",
  leftoverLabel: "Assign leftover",
  bookHref: "/invest?tab=do",
  bookLabel: "Open the book",
  learnHref: "/freedom?tab=learn",
  learnLabel: "Learn Freedom",
} as const;

export const JOURNEY_HOME_EMPTY = {
  hint: "Start with Learn, or open Budget Do for the first-run kit. This page does not invent leftover, a book, or a Freedom date.",
  freedomLabel: FREEDOM_DATE_NEEDS_INPUTS,
  freedomHint:
    "From leftover and the book only. Leftover is one-time cash, not × 12. This page will not invent a date.",
  leftoverHref: "/budget?tab=do",
  leftoverLabel: "Assign leftover",
  bookHref: "/invest?tab=do",
  bookLabel: "Open the book",
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
