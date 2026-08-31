import type { AnalysisQuote } from "@/lib/analysis/types";
import type { InvestSalsaRating } from "@/lib/analysis/rating/types";
import type { TapeSeriesMeta } from "@/lib/invest/assess/tape-series";

export type CallVerdict =
  | "Buy"
  | "Add"
  | "Hold"
  | "Trim"
  | "Sell"
  | "Wait"
  | "Pass";

export type MoveVerdict = "Hold" | "Trim" | "Add" | "Sell" | "Buy" | "Wait" | "Pass";

export type TapePeriodKind = "annual" | "quarter";

export type TapePoint = {
  period: string;
  periodKind: TapePeriodKind;
  revenue: number | null;
  netIncome: number | null;
  ebitda: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  stockBasedCompensation: number | null;
  dividendsPaid: number | null;
  cashAndSti: number | null;
  totalDebt: number | null;
};

export type TapeMissingEntry = {
  period: string;
  series: string;
};

export type TapeVehicleInfo = {
  isOperatingTape: boolean;
  label: string | null;
  reason: string | null;
  capitalProfile: string | null;
};

export type TapeBundle = {
  symbol: string;
  name: string | null;
  unit: "millions" | "billions";
  unitLabel: string;
  annual: TapePoint[];
  quarterly: TapePoint[];
  missing: TapeMissingEntry[];
  autoOpenQuarterly: boolean;
  quarterlyNote: string | null;
  vehicle: TapeVehicleInfo;
  incomplete: boolean;
  ttmCaption: string | null;
};

export type AssessNoteSection = {
  call: { verdict: CallVerdict; why: string };
  industry: string;
  asset: string;
  growth: string;
  fundamentals: {
    killSwitches: string[];
    trendRead: string;
  };
  technicals: string;
  industryOutlook: string;
  dissent: string;
  decision: string;
};

export type AssessPayload = {
  quote: AnalysisQuote;
  rating: InvestSalsaRating;
  tape: TapeSeriesMeta;
  note: AssessNoteSection;
  meta: {
    packageDegraded: boolean;
    confidenceNote: string | null;
    analysisHref: string;
    assessHref?: string;
  };
};

export type BookContext = {
  owned: boolean;
  portfolioPercent: number | null;
  positionValue: number | null;
  concentrationNote: string | null;
  leftoverLine: string | null;
};
