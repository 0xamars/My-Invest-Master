import type { EarlyOppStepId } from "@/lib/analysis/early-opp/steps";
import type { AnalysisQuote } from "@/lib/analysis/types";

export type EarlyOppStatus = "pass" | "soft" | "fail" | "unknown";

export type EarlyOppNumberKind =
  | "money"
  | "percent"
  | "ratio"
  | "multiple"
  | "count"
  | "text";

export type EarlyOppNumber = {
  label: string;
  /** Formatted for display. Never invent — omit the row if the input is missing. */
  display: string;
  /** Raw numeric value when the figure is a number. */
  value: number | null;
  kind: EarlyOppNumberKind;
  source: "fmp";
};

export type EarlyOppStepResult = {
  id: EarlyOppStepId;
  number: number;
  title: string;
  shortTitle: string;
  question: string;
  hint: string;
  status: EarlyOppStatus;
  explanation: string;
  numbers: EarlyOppNumber[];
  source: "fmp" | "ai" | "hybrid" | "education";
};

export type EarlyOppCounts = {
  pass: number;
  soft: number;
  fail: number;
  unknown: number;
};

export type EarlyOppAiMeta = {
  configured: boolean;
  available: boolean;
  source: "live" | "cache" | "unavailable" | "missing_key";
  model: string | null;
};

export type EarlyOppPayload = {
  quote: AnalysisQuote;
  steps: EarlyOppStepResult[];
  counts: EarlyOppCounts;
  disclaimer: string;
  meta: {
    frameworkId: "early-opp-16";
    frameworkVersion: string;
    packageDegraded: boolean;
    confidenceNote: string | null;
    analysisHref: string;
    assessHref: string;
    ai: EarlyOppAiMeta;
  };
};

export type EarlyOppQualitativeOverlay = {
  secularTheme: string | null;
  secularStatus: EarlyOppStatus | null;
  sCurveNote: string | null;
  stackRole: string | null;
  winnerNote: string | null;
  moatNote: string | null;
  moatCopyTest: "hard_to_copy" | "copyable" | "unclear" | null;
  whyMoving: string | null;
};
