import Link from "next/link";
import { getChartSeriesColor } from "@/lib/portfolio/chart-theme";
import { formatTickerPrice, TICKER_UNKNOWN } from "@/lib/ticker/format";
import type { BookRow } from "@/lib/ticker/book";
import { cn } from "@/lib/utils";

export function BookConcentrationBar({ rows }: { rows: BookRow[] }) {
  const slices = rows.filter((row) => row.weight != null && row.weight > 0);
  if (!slices.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Concentration · {TICKER_UNKNOWN}
      </p>
    );
  }

  return (
    <div>
      <div
        className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]"
        role="img"
        aria-label="Book concentration"
      >
        {slices.map((row, index) => (
          <span
            key={row.id}
            title={`${row.name} ${row.weight!.toFixed(0)}%`}
            className="h-full"
            style={{
              width: `${row.weight}%`,
              background: getChartSeriesColor(index),
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {slices.map((row, index) => (
          <li key={row.id} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-sm"
              style={{ background: getChartSeriesColor(index) }}
            />
            <span
              className={cn(
                (row.weight ?? 0) >= 25 && "font-medium text-foreground",
              )}
            >
              {row.ticker} {row.weight!.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BookTable({ rows }: { rows: BookRow[] }) {
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Name</th>
            <th className="py-2 pr-3 font-medium">Ticker</th>
            <th className="py-2 pr-3 font-medium">Weight</th>
            <th className="py-2 pr-3 font-medium">Price</th>
            <th className="py-2 pr-3 font-medium">Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const name = row.href ? (
              <Link href={row.href} className="font-medium hover:underline">
                {row.name}
              </Link>
            ) : (
              <span className="font-medium">{row.name}</span>
            );
            return (
              <tr key={row.id} className="border-t border-border/50">
                <td className="py-2.5 pr-3">{name}</td>
                <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                  {row.href ? (
                    <Link href={row.href} className="hover:underline">
                      {row.ticker}
                    </Link>
                  ) : (
                    row.ticker
                  )}
                </td>
                <td
                  className={cn(
                    "py-2.5 pr-3 tabular-nums",
                    (row.weight ?? 0) >= 25 && "font-semibold",
                  )}
                >
                  {row.weight == null ? TICKER_UNKNOWN : `${row.weight.toFixed(0)}%`}
                </td>
                <td className="py-2.5 pr-3 tabular-nums">
                  {formatTickerPrice(row.price)}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                  {row.healthMark}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
