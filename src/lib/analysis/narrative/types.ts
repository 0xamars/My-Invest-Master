import type { AnalysisRecentEvent } from "@/lib/analysis/recent-events";

export type NarrativePillarBlurbs = {
  financialStrength: string;
  profitability: string;
  growth: string;
  valuation: string;
};

export type NarrativeTechnicalBlurbs = {
  priceZone: string;
  meanExtension: string;
};

export type NarrativeOutlookItem = {
  title: string;
  body: string;
};

export type NarrativeFutureOutlook = {
  opportunities: NarrativeOutlookItem[];
  risks: NarrativeOutlookItem[];
};

export function outlookItemText(item: NarrativeOutlookItem): string {
  return `${item.title} ${item.body}`.replace(/\s+/g, " ").trim();
}

export function outlookListText(items: NarrativeOutlookItem[]): string {
  return items.map(outlookItemText).join(" ");
}

export type AnalysisNarrativeBundle = {
  fundamentalOverview: string;
  pillars: NarrativePillarBlurbs;
  technicalOverview: string;
  technical: NarrativeTechnicalBlurbs;
  futureOutlook: NarrativeFutureOutlook;
  summary: string;
  /** 4–6 retail bullets; UI prefers this over the joined summary paragraph. */
  summaryBullets: string[];
};

export type NarrativeMetricSnap = {
  label: string;
  display: string | null;
};

/** Compact warehouse/pillar fact for Outlook grounding — display only, never invented. */
export type NarrativePackageFact = {
  id: string;
  label: string;
  display: string;
};

export type NarrativeContext = {
  symbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  /** Short public profile excerpt for business-line / region grounding. */
  description: string | null;
  path: string | null;
  /** Capital overlay id (e.g. insurance_life) — copy hint only, not a score. */
  capitalOverlay: string | null;
  vehicle: string | null;
  period: string | null;
  confidence: string | null;
  scores: {
    overall: number | null;
    fundamental: number | null;
    technical: number | null;
    financialStrength: number | null;
    profitability: number | null;
    growth: number | null;
    valuation: number | null;
  };
  display10: {
    overall: string;
    fundamental: string;
    technical: string;
    financialStrength: string;
    profitability: string;
    growth: string;
    valuation: string;
  };
  pillarMetrics: {
    financialStrength: NarrativeMetricSnap[];
    profitability: NarrativeMetricSnap[];
    growth: NarrativeMetricSnap[];
    valuation: NarrativeMetricSnap[];
  };
  /** Selected growth / margin / cash / leverage / valuation displays for Outlook. */
  packageFacts: NarrativePackageFact[];
  technical: {
    zone: string | null;
    zoneLabel: string | null;
    relativeLabel: string | null;
    nearLabel: string | null;
    mediumLabel: string | null;
    longLabel: string | null;
  };
  notes: string[];
  recentEvents: AnalysisRecentEvent[];
  /** high / normal / low when SBC/revenue is in the package; else omit. */
  sbcBurden: "low" | "normal" | "high" | null;
  /** current = no usable forward PE/estimates — do not imply forecast precision. */
  valuationLanguage: {
    basis: "current" | "includes_forward";
  };
  /** Street average target vs price — omit when Forecast has no target. */
  streetTarget: {
    average: number;
    vsPricePct: number | null;
  } | null;
  /** Copy-only hints from existing metrics/scores — not a new score. */
  copyLanguage: NarrativeCopyLanguage;
};

export type NarrativeCopyLanguage = {
  earnings: "unprofitable" | "profitable" | "treasury_marks" | "unknown";
  cash: "burning" | "converting" | "unknown";
  margins: "strong" | "compressed" | "unknown";
  growth: "elite" | "solid" | "slow" | "unknown";
  balanceSheet: "fortress" | "adequate" | "weak" | "unknown";
  valuationConstraint: "expensive" | "full" | "not_the_story" | "unknown";
};

export type NarrativeResponse = {
  bundle: AnalysisNarrativeBundle;
  source: "ai" | "cache" | "fallback";
  configured: boolean;
  model: string | null;
  /** Present when source is fallback after timeout or a failed generate. */
  error?: string | null;
};
