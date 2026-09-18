/**
 * Early Opportunity 16-step framework — product labels and educational copy.
 * Source of truth: docs/early-opp-framework-16step.md
 */

export const EARLY_OPP_FRAMEWORK_ID = "early-opp-16" as const;
export const EARLY_OPP_FRAMEWORK_VERSION = "2026-09-17";

export const EARLY_OPP_STEP_IDS = [
  "know_yourself",
  "secular_trend",
  "s_curve",
  "follow_the_money",
  "who_gets_capex",
  "identify_winners",
  "financials_fcf",
  "kill_switches",
  "capex_roic",
  "moat",
  "ownership",
  "analyst_targets",
  "peg",
  "chart_timing",
  "why_moving",
  "exit_plan",
] as const;

export type EarlyOppStepId = (typeof EARLY_OPP_STEP_IDS)[number];

export type EarlyOppStepDef = {
  id: EarlyOppStepId;
  number: number;
  title: string;
  shortTitle: string;
  question: string;
  hint: string;
  qualitative: boolean;
};

export const EARLY_OPP_STEPS: readonly EarlyOppStepDef[] = [
  {
    id: "know_yourself",
    number: 1,
    title: "Know yourself",
    shortTitle: "Temperament",
    question: "Does this process match how you actually invest?",
    hint: "Temperament and blind spots come first. This step is not scored from market data.",
    qualitative: false,
  },
  {
    id: "secular_trend",
    number: 2,
    title: "Secular trend",
    shortTitle: "Trend",
    question: "Is the company sitting on a multi-year spend wave?",
    hint: "Play where the puck is going. Industry and theme first; ticker second.",
    qualitative: true,
  },
  {
    id: "s_curve",
    number: 3,
    title: "Catch the S-curve early",
    shortTitle: "S-curve",
    question: "Is growth still early, or already the crowded steep part?",
    hint: "Position before the crowd notices. Flat to vertical can repeat.",
    qualitative: true,
  },
  {
    id: "follow_the_money",
    number: 4,
    title: "Follow the money",
    shortTitle: "Spend",
    question: "Is future spend showing up in CapEx?",
    hint: "Quantify investment intensity from loaded cash-flow statements — do not invent dollars.",
    qualitative: false,
  },
  {
    id: "who_gets_capex",
    number: 5,
    title: "Who gets the CapEx",
    shortTitle: "Stack",
    question: "Where in the bill of materials does this name sit?",
    hint: "Map the stack before the P&L proves it. Industry is a hint, not a BOM.",
    qualitative: true,
  },
  {
    id: "identify_winners",
    number: 6,
    title: "Identify winners",
    shortTitle: "Winners",
    question: "Does quality, growth, and investment intensity line up?",
    hint: "A few names drive most long-run returns. Moats, roadmaps, switching costs.",
    qualitative: true,
  },
  {
    id: "financials_fcf",
    number: 7,
    title: "Financials",
    shortTitle: "FCF",
    question: "Are revenue, margins, and free cash flow compounding?",
    hint: "Free cash flow growth is the golden line. Avoid sales up and margins collapsing.",
    qualitative: false,
  },
  {
    id: "kill_switches",
    number: 8,
    title: "Financial kill switches",
    shortTitle: "Kill switches",
    question: "Do dilution, cash burn, or debt vs profit fail the name?",
    hint: "Cash burn with no share gains, serial dilution, forever “adjusted” earnings, debt out of line.",
    qualitative: false,
  },
  {
    id: "capex_roic",
    number: 9,
    title: "CapEx quality / ROIC",
    shortTitle: "ROIC",
    question: "Is spend building a moat, or just burning cash?",
    hint: "Rising CapEx into a demand wave can be bullish if ROIC holds.",
    qualitative: false,
  },
  {
    id: "moat",
    number: 10,
    title: "Moat",
    shortTitle: "Moat",
    question: "Could a well-funded rival copy this in three years or less?",
    hint: "If it can be copied in ≤3 years, it is not a moat. Numbers are a proxy only.",
    qualitative: true,
  },
  {
    id: "ownership",
    number: 11,
    title: "Ownership / smart money",
    shortTitle: "Ownership",
    question: "Are insiders adding, or distributing?",
    hint: "Insider buys are a soft bullish tell. Heavy insider selling is a caution. 13F is a soft signal.",
    qualitative: false,
  },
  {
    id: "analyst_targets",
    number: 12,
    title: "Analyst targets",
    shortTitle: "Sentiment",
    question: "What is street sentiment — not a fair-value number?",
    hint: "Price targets are sentiment only. Wall Street often misses S-curves. Crowded consensus fades edge.",
    qualitative: false,
  },
  {
    id: "peg",
    number: 13,
    title: "PEG",
    shortTitle: "PEG",
    question: "Is the multiple cheap relative to loaded earnings growth?",
    hint: "P/E ÷ expected earnings growth. Under 1 can be cheap on growth — only when PEG is actually loaded.",
    qualitative: false,
  },
  {
    id: "chart_timing",
    number: 14,
    title: "Chart timing after fundamentals",
    shortTitle: "Timing",
    question: "Is the price zone a time to act, or a time to wait?",
    hint: "Fundamentals say what. The chart says when. Do not buy a broken thesis because it looks cheap.",
    qualitative: false,
  },
  {
    id: "why_moving",
    number: 15,
    title: "Why is it moving",
    shortTitle: "Why",
    question: "Can you explain the move — or why it is stuck?",
    hint: "If you do not know why, you do not have an edge. Knowing why it is stuck while the thesis holds can still be useful.",
    qualitative: true,
  },
  {
    id: "exit_plan",
    number: 16,
    title: "Exit, size, kill switch",
    shortTitle: "Exit plan",
    question: "Have you written the exit and size before entry?",
    hint: "Write the exit at entry. Size the flyer. Kill when the thesis changes. This step is not scored from market data.",
    qualitative: false,
  },
] as const;

export function earlyOppStepById(id: EarlyOppStepId): EarlyOppStepDef {
  const step = EARLY_OPP_STEPS.find((item) => item.id === id);
  if (!step) {
    throw new Error(`Unknown Early Opp step: ${id}`);
  }
  return step;
}
