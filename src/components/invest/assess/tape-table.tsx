import { formatTickerField } from "@/lib/ticker/format";
import type { TapePoint } from "@/lib/invest/assess/types";

const COLUMN_DEFS: Array<{
  key: keyof TapePoint;
  label: string;
  when?: (points: TapePoint[]) => boolean;
}> = [
  { key: "revenue", label: "Revenue" },
  { key: "netIncome", label: "Net income" },
  { key: "ebitda", label: "EBITDA" },
  { key: "operatingCashFlow", label: "Operating CF" },
  { key: "freeCashFlow", label: "Free CF" },
  { key: "stockBasedCompensation", label: "SBC" },
  {
    key: "dividendsPaid",
    label: "Dividends",
    when: (points) =>
      points.some((p) => p.dividendsPaid != null && p.dividendsPaid !== 0),
  },
  { key: "cashAndSti", label: "Cash + STI" },
  { key: "totalDebt", label: "Total debt" },
];

function cell(value: number | null): string {
  return formatTickerField({ label: "", value, kind: "money" });
}

export function TapeTable({ points }: { points: TapePoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No fiscal periods loaded.</p>
    );
  }

  const columns = COLUMN_DEFS.filter(
    (col) => !col.when || col.when(points),
  ).filter((col) =>
    points.some((p) => p[col.key] != null && Number.isFinite(p[col.key] as number)),
  );

  const rows = [...points].reverse();

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th className="px-3 py-2 font-medium text-muted-foreground">Period</th>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 font-medium text-muted-foreground">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((point) => (
            <tr key={point.period} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2 font-medium">{point.period}</td>
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2 tabular-nums">
                  {cell(point[col.key] as number | null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
