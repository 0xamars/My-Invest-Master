"use client";

import { AlertTriangle, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  AnalyticsChartCard,
} from "@/components/analytics/analytics-chart-card";
import { cn } from "@/lib/utils";
import {
  riskLevelDescription,
  riskLevelLabel,
  type ConcentrationMetrics,
  type IntelligenceInsight,
  type IntelligenceRiskLevel,
} from "@/lib/portfolio/intelligence";
import { formatAllocationPercent } from "@/lib/portfolio/allocation-chart";
import { getHoldingChartLabel } from "@/lib/portfolio/allocation-chart";

function riskBadgeClass(level: IntelligenceRiskLevel): string {
  if (level === "high") {
    return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";
  }
  if (level === "moderate") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
}

function severityIcon(severity: IntelligenceInsight["severity"]) {
  if (severity === "alert") {
    return <ShieldAlert className="size-4 text-red-500 dark:text-red-400" />;
  }
  if (severity === "watch") {
    return (
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
    );
  }
  return <Info className="size-4 text-primary" />;
}

interface ConcentrationRiskPanelProps {
  concentration: ConcentrationMetrics;
  overallRisk: IntelligenceRiskLevel;
}

export function ConcentrationRiskPanel({
  concentration,
  overallRisk,
}: ConcentrationRiskPanelProps) {
  const rows = [
    {
      label: "Top holding",
      weight: concentration.top1Weight,
      detail: concentration.top1Holding
        ? getHoldingChartLabel(concentration.top1Holding)
        : "—",
    },
    {
      label: "Top 3 holdings",
      weight: concentration.top3Weight,
      detail: `${concentration.top3Holdings.length} names`,
    },
    {
      label: "Top 5 holdings",
      weight: concentration.top5Weight,
      detail: `${concentration.top5Holdings.length} names`,
    },
  ];

  return (
    <AnalyticsChartCard
      title="Concentration risk"
      description="How much portfolio value sits in the largest positions"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overall risk (rules-based)
          </p>
          <div className="flex items-center gap-2">
            {overallRisk === "low" ? (
              <ShieldCheck className="size-5 text-emerald-500" />
            ) : overallRisk === "moderate" ? (
              <AlertTriangle className="size-5 text-amber-500" />
            ) : (
              <ShieldAlert className="size-5 text-red-500" />
            )}
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-semibold",
                riskBadgeClass(overallRisk),
              )}
            >
              {riskLevelLabel(overallRisk)}
            </span>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">
            {riskLevelDescription(overallRisk)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {row.label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
              {formatAllocationPercent(row.weight)}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.detail}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  row.weight >= 40
                    ? "bg-red-500/80"
                    : row.weight >= 25
                      ? "bg-amber-500/80"
                      : "bg-primary/80",
                )}
                style={{ width: `${Math.min(row.weight, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </AnalyticsChartCard>
  );
}

interface IntelligenceInsightsPanelProps {
  insights: IntelligenceInsight[];
}

export function IntelligenceInsightsPanel({
  insights,
}: IntelligenceInsightsPanelProps) {
  return (
    <AnalyticsChartCard
      title="Risk insights"
      description="Explainable flags from portfolio weights and P/L — not AI predictions"
    >
      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No insights yet. Add priced holdings to generate risk flags.
        </p>
      ) : (
        <ul className="space-y-3">
          {insights.map((insight) => (
            <li
              key={insight.id}
              className="flex gap-3 rounded-xl border border-border/70 bg-muted/15 px-4 py-3"
              data-insight-code={insight.id}
            >
              <div className="mt-0.5 shrink-0">
                {severityIcon(insight.severity)}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{insight.title}</p>
                  {insight.metric && (
                    <span className="rounded-md border border-border/80 bg-background/60 px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums text-muted-foreground">
                      {insight.metric}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {insight.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AnalyticsChartCard>
  );
}
