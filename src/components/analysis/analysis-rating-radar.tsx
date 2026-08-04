"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
} from "recharts";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import type { RadarAxis } from "@/lib/analysis/rating/types";

const chartConfig = {
  score: {
    label: "Score",
    color: "var(--brand-green)",
  },
} satisfies ChartConfig;

/** Prefer two-line ticks for long axis names so nothing is clipped. */
function tickLines(label: string): string[] {
  switch (label) {
    case "Financial Strength":
      return ["Financial", "Strength"];
    case "Price structure":
      return ["Price", "structure"];
    case "Momentum Condition":
      return ["Momentum", "Condition"];
    default:
      return [label];
  }
}

function RadarAxisTick(props: {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  payload?: { value?: string };
  textAnchor?: string;
}) {
  const { x = 0, y = 0, cx = 0, cy = 0, payload } = props;
  const textAnchor =
    props.textAnchor === "start" ||
    props.textAnchor === "end" ||
    props.textAnchor === "middle" ||
    props.textAnchor === "inherit"
      ? props.textAnchor
      : "middle";
  const label = payload?.value ?? "";
  const lines = tickLines(label);

  // Nudge labels slightly outward from the plot center for clearance.
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const pad = 10;
  const tx = x + (dx / dist) * pad;
  const ty = y + (dy / dist) * pad;
  const lineHeight = 12;
  const startY = ty - ((lines.length - 1) * lineHeight) / 2;

  return (
    <text
      x={tx}
      y={startY}
      textAnchor={textAnchor}
      fill="var(--chart-label)"
      fontSize={11}
      style={{ pointerEvents: "none" }}
    >
      {lines.map((line) => (
        <tspan key={line} x={tx} dy={line === lines[0] ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export function AnalysisRatingRadar({ axes }: { axes: RadarAxis[] }) {
  const data = axes.map((axis) => ({
    axis: axis.label,
    score: axis.value ?? 0,
    hasData: axis.value != null,
  }));

  const anyData = axes.some((a) => a.value != null);
  if (!anyData) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 text-center text-sm text-muted-foreground">
        Radar unavailable — not enough pillar data yet.
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square h-[320px] w-full max-w-[360px] overflow-visible [&_.recharts-surface]:overflow-visible"
      initialDimension={{ width: 360, height: 320 }}
    >
      <RadarChart
        data={data}
        cx="50%"
        cy="50%"
        outerRadius="52%"
        margin={{ top: 28, right: 36, bottom: 28, left: 36 }}
      >
        <PolarGrid stroke="var(--chart-grid)" />
        <PolarAngleAxis
          dataKey="axis"
          tick={<RadarAxisTick />}
          tickLine={false}
        />
        <Radar
          dataKey="score"
          stroke="var(--brand-green)"
          fill="var(--brand-green)"
          fillOpacity={0.28}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </RadarChart>
    </ChartContainer>
  );
}
