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

export type NarrativeFutureOutlook = {
  opportunities: string[];
  risks: string[];
};

export type AnalysisNarrativeBundle = {
  fundamentalOverview: string;
  pillars: NarrativePillarBlurbs;
  technicalOverview: string;
  technical: NarrativeTechnicalBlurbs;
  futureOutlook: NarrativeFutureOutlook;
  summary: string;
};

export type NarrativeMetricSnap = {
  label: string;
  display: string | null;
};

export type NarrativeContext = {
  symbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  path: string | null;
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
  technical: {
    zone: string | null;
    zoneLabel: string | null;
    relativeLabel: string | null;
    nearLabel: string | null;
    mediumLabel: string | null;
    longLabel: string | null;
  };
  notes: string[];
};

export type NarrativeResponse = {
  bundle: AnalysisNarrativeBundle;
  source: "ai" | "cache" | "fallback";
  configured: boolean;
  model: string | null;
};
