/** Structured investor-context rows from FMP (never invented). */
export type AnalysisRecentEventType = "insider" | "ma";

export type AnalysisRecentEvent = {
  type: AnalysisRecentEventType;
  summary: string;
  date: string | null;
};
