import { formatScoreMark } from "@/lib/ticker/score";
import { TICKER_UNKNOWN } from "@/lib/ticker/format";
import type { ScoreAxis, TickerScore } from "@/lib/ticker/score-types";
import { cn } from "@/lib/utils";

const ORDER: ScoreAxis["key"][] = [
  "past",
  "future",
  "health",
  "value",
  "dividend",
];

const SIZE = 220;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 78;

function axisAt(key: ScoreAxis["key"], score: TickerScore): ScoreAxis | null {
  return score.axes.find((axis) => axis.key === key) ?? null;
}

function point(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  };
}

function petalPath(index: number, fill: number) {
  const step = 360 / ORDER.length;
  const angle = index * step;
  const left = point(angle - 28, 18);
  const tip = point(angle, RADIUS * Math.max(fill, 0.08));
  const right = point(angle + 28, 18);
  return `M ${CX} ${CY} L ${left.x} ${left.y} Q ${tip.x} ${tip.y} ${right.x} ${right.y} Z`;
}

function outlinePath(index: number) {
  const step = 360 / ORDER.length;
  const angle = index * step;
  const left = point(angle - 28, 18);
  const tip = point(angle, RADIUS);
  const right = point(angle + 28, 18);
  return `M ${CX} ${CY} L ${left.x} ${left.y} Q ${tip.x} ${tip.y} ${right.x} ${right.y} Z`;
}

function fillRatio(axis: ScoreAxis | null): number {
  if (!axis || axis.status === "unknown" || axis.scored == null || axis.scored === 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, (axis.passed ?? 0) / axis.scored));
}

export function TickerScoreGraphic({ score }: { score: TickerScore }) {
  const scoredAxes = ORDER.map((key) => axisAt(key, score)).filter(
    (axis): axis is ScoreAxis =>
      Boolean(axis && axis.status === "scored" && axis.checks.length),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <div className="flex flex-col items-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-56 w-56"
          role="img"
          aria-label="Five-point Score"
        >
          <title>Score</title>
          {ORDER.map((key, index) => {
            const axis = axisAt(key, score);
            const fill = fillRatio(axis);
            return (
              <g key={key}>
                <path
                  d={outlinePath(index)}
                  fill="none"
                  stroke="color-mix(in srgb, var(--brand-muted) 45%, transparent)"
                  strokeWidth="1.2"
                />
                {fill > 0 ? (
                  <path
                    d={petalPath(index, fill)}
                    fill="color-mix(in srgb, var(--brand-green) 72%, transparent)"
                  />
                ) : null}
              </g>
            );
          })}
          {ORDER.map((key, index) => {
            const axis = axisAt(key, score);
            const tip = point(index * (360 / ORDER.length), RADIUS + 22);
            return (
              <text
                key={`${key}-label`}
                x={tip.x}
                y={tip.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="currentColor"
                fontSize="11"
              >
                {axis?.label ?? key}
              </text>
            );
          })}
        </svg>
        <p className="mt-1 text-xs text-muted-foreground">Five-point Score</p>
      </div>

      <div className="space-y-4">
        <ul className="grid gap-2 sm:grid-cols-2">
          {ORDER.map((key) => {
            const axis = axisAt(key, score);
            const mark = formatScoreMark(axis);
            return (
              <li key={key} className="flex items-baseline justify-between gap-3 text-sm">
                <span>{axis?.label ?? key}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    mark === TICKER_UNKNOWN
                      ? "text-muted-foreground"
                      : "font-medium",
                  )}
                >
                  {mark}
                </span>
              </li>
            );
          })}
        </ul>
        {scoredAxes.map((axis) => (
          <div key={axis.key} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {axis.label} inputs · {formatScoreMark(axis)}
            </p>
            <ul className="space-y-2">
              {axis.checks.map((item) => (
                <li key={item.id} className="rounded-lg bg-white/[0.03] px-3 py-2">
                  <p className="text-sm">
                    {item.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.passed == null
                        ? TICKER_UNKNOWN
                        : item.passed
                          ? "Pass"
                          : "Fail"}
                    </span>
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {item.inputs.map((field) => (
                      <li key={field.label} className="flex justify-between gap-3">
                        <span>{field.label}</span>
                        <span className="tabular-nums">{field.value}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
