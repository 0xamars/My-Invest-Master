"use client";

import { useMemo } from "react";
import { useXAxisScale, usePlotArea } from "recharts";
import { CHART_AXIS_COLOR } from "@/lib/portfolio/chart-theme";

export interface ProjectionMilestone {
  /** X-axis data value — must match the corresponding ReferenceLine `x`. */
  x: number;
  year: number;
  caption: string;
  color: string;
}

interface ProjectionXAxisLabelsProps {
  xAxisTicks: number[];
  milestones: ProjectionMilestone[];
}

const AXIS_DY = 4;
const YEAR_FONT_SIZE = 11;
const MILESTONE_YEAR_FONT_SIZE = 10;
const MILESTONE_CAPTION_FONT_SIZE = 9;
const MILESTONE_LINE_GAP = 11;
/** Minimum pixel gap between a regular tick center and a milestone label center. */
const OVERLAP_THRESHOLD_PX = 32;

function overlapsMilestone(
  tickValue: number,
  tickPixelX: number,
  milestones: Array<{ x: number; year: number; pixelX: number }>,
): boolean {
  return milestones.some(
    (milestone) =>
      tickValue === milestone.year ||
      Math.abs(tickPixelX - milestone.pixelX) < OVERLAP_THRESHOLD_PX,
  );
}

/** Renders X-axis year ticks and milestone labels on one shared row. */
export function ProjectionXAxisLabels({
  xAxisTicks,
  milestones,
}: ProjectionXAxisLabelsProps) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale();

  const layout = useMemo(() => {
    if (!plotArea || !xScale) return null;

    const labelY = plotArea.y + plotArea.height + AXIS_DY;

    const milestoneLayout = milestones
      .map((milestone) => {
        const pixelX = xScale(milestone.x);
        if (pixelX == null || Number.isNaN(pixelX)) return null;
        return { ...milestone, pixelX };
      })
      .filter((entry): entry is ProjectionMilestone & { pixelX: number } =>
        entry != null,
      );

    const regularTicks = xAxisTicks
      .map((tick) => {
        const pixelX = xScale(tick);
        if (pixelX == null || Number.isNaN(pixelX)) return null;
        if (overlapsMilestone(tick, pixelX, milestoneLayout)) return null;
        return { tick, pixelX };
      })
      .filter((entry): entry is { tick: number; pixelX: number } => entry != null);

    return { labelY, milestoneLayout, regularTicks };
  }, [milestones, plotArea, xAxisTicks, xScale]);

  if (!layout) return null;

  return (
    <g className="pointer-events-none select-none">
      {layout.regularTicks.map(({ tick, pixelX }) => (
        <text
          key={`year-${tick}`}
          x={pixelX}
          y={layout.labelY}
          fill={CHART_AXIS_COLOR}
          fontSize={YEAR_FONT_SIZE}
          fontWeight={500}
          fontFamily="inherit"
          textAnchor="middle"
          dominantBaseline="hanging"
        >
          {tick}
        </text>
      ))}

      {layout.milestoneLayout.map((milestone) => (
        <g
          key={`${milestone.year}-${milestone.caption}`}
          transform={`translate(${milestone.pixelX}, ${layout.labelY})`}
          textAnchor="middle"
        >
          <text
            y={0}
            fill={milestone.color}
            fontSize={MILESTONE_YEAR_FONT_SIZE}
            fontWeight={600}
            fontFamily="inherit"
            dominantBaseline="hanging"
            letterSpacing="0.01em"
          >
            {milestone.year}
          </text>
          <text
            y={MILESTONE_LINE_GAP}
            fill={milestone.color}
            fontSize={MILESTONE_CAPTION_FONT_SIZE}
            fontWeight={500}
            fontFamily="inherit"
            dominantBaseline="hanging"
            opacity={0.92}
            letterSpacing="0.02em"
          >
            {milestone.caption}
          </text>
        </g>
      ))}
    </g>
  );
}
