"use client";

import type { PieLabelRenderProps } from "recharts";
import { formatAllocationPercent } from "@/lib/portfolio/allocation-chart";
import {
  CHART_LABEL_COLOR,
  CHART_LABEL_LINE_COLOR,
  CHART_LABEL_MUTED_COLOR,
} from "@/lib/portfolio/chart-theme";

const CHART_LABEL_FONT = "var(--font-sans)";

type SliceLabelProps = PieLabelRenderProps & {
  label?: string;
  portfolioPercent?: number;
};

const LABEL_RADIAL = 24;
const LABEL_HORIZONTAL = 40;

function getSlicePayload(props: SliceLabelProps) {
  const label =
    (props.payload as { label?: string } | undefined)?.label ??
    props.label ??
    "";
  const portfolioPercent =
    (props.payload as { portfolioPercent?: number } | undefined)
      ?.portfolioPercent ??
    props.portfolioPercent ??
    0;

  return { label, portfolioPercent };
}

function getSliceLabelGeometry(props: SliceLabelProps) {
  const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0 } = props;
  const RADIAN = Math.PI / 180;
  const cos = Math.cos(-RADIAN * midAngle);
  const sin = Math.sin(-RADIAN * midAngle);
  const isRight = cos >= 0;

  const sx = cx + outerRadius * cos;
  const sy = cy + outerRadius * sin;
  const mx = cx + (outerRadius + LABEL_RADIAL) * cos;
  const my = cy + (outerRadius + LABEL_RADIAL) * sin;
  const ex = mx + (isRight ? LABEL_HORIZONTAL : -LABEL_HORIZONTAL);
  const ey = my;
  const x = ex + (isRight ? 8 : -8);

  return {
    sx,
    sy,
    mx,
    my,
    ex,
    ey,
    x,
    y: ey,
    textAnchor: isRight ? ("start" as const) : ("end" as const),
  };
}

export function renderAllocationLabelLine(props: SliceLabelProps) {
  const { portfolioPercent } = getSlicePayload(props);
  const { sx, sy, mx, my, ex, ey } = getSliceLabelGeometry(props);

  if (portfolioPercent < 0.75) {
    return (
      <polyline
        points={`${sx},${sy} ${sx},${sy}`}
        stroke="transparent"
        fill="none"
      />
    );
  }

  return (
    <polyline
      points={`${sx},${sy} ${mx},${my} ${ex},${ey}`}
      stroke={CHART_LABEL_LINE_COLOR}
      strokeWidth={1.25}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function renderAllocationSliceLabel(props: SliceLabelProps) {
  const { label, portfolioPercent } = getSlicePayload(props);
  if (portfolioPercent < 0.75) {
    return null;
  }

  const { x, y, textAnchor } = getSliceLabelGeometry(props);
  const isLargeSlice = portfolioPercent >= 5;

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline="middle"
      fill={CHART_LABEL_COLOR}
      fontFamily={CHART_LABEL_FONT}
      className="select-none"
    >
      <tspan
        x={x}
        dy="-0.6em"
        fill={CHART_LABEL_COLOR}
        fontSize={isLargeSlice ? 13 : 12}
        fontWeight={isLargeSlice ? 600 : 500}
      >
        {label}
      </tspan>
      <tspan
        x={x}
        dy="1.25em"
        fill={CHART_LABEL_MUTED_COLOR}
        fontSize={12}
        fontWeight={400}
      >
        {formatAllocationPercent(portfolioPercent)}
      </tspan>
    </text>
  );
}
