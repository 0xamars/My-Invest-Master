"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

export function QuietSparkline({
  points,
  label = "Day move",
}: {
  points: readonly number[] | null;
  label?: string;
}) {
  if (!points || points.length < 2) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const up = last >= first;
  const data = points.map((value, index) => ({ index, value }));

  return (
    <div
      className="quiet-sparkline"
      role="img"
      aria-label={label}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 1, bottom: 2, left: 1 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={up ? "var(--brand-green)" : "var(--brand-orange)"}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
