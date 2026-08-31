"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TapeChart } from "@/components/invest/assess/tape-chart";
import { TapeTable } from "@/components/invest/assess/tape-table";
import { buildQuarterlyChangeNote, buildTapeRead } from "@/lib/invest/assess/tape-read";
import type { TapeSeriesMeta } from "@/lib/invest/assess/tape-series";

export function TapeView({ tape }: { tape: TapeSeriesMeta }) {
  const [quarterlyMode, setQuarterlyMode] = useState(tape.autoOpenQuarterly);
  const points = quarterlyMode ? tape.quarterly : tape.annual;
  const read = buildTapeRead({
    name: tape.name,
    symbol: tape.symbol,
    annual: tape.annual,
    isOperatingTape: tape.vehicle.isOperatingTape,
  });
  const quarterNote = quarterlyMode
    ? buildQuarterlyChangeNote(tape.quarterly) ?? tape.quarterlyNote
    : null;

  const missingList = Object.entries(
    tape.missing.reduce<Record<string, Set<string>>>((acc, item) => {
      if (!acc[item.period]) acc[item.period] = new Set();
      acc[item.period]!.add(item.series);
      return acc;
    }, {}),
  ).map(([period, series]) => `${period}: ${[...series].join(", ")}`);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold">
          {tape.name ? `${tape.name} (${tape.symbol})` : tape.symbol}
        </h2>
        {!tape.vehicle.isOperatingTape && tape.vehicle.reason ? (
          <p className="mt-1 text-sm text-muted-foreground">{tape.vehicle.reason}</p>
        ) : null}
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Read</h3>
        <p className="text-sm leading-relaxed">{read}</p>
        {tape.ttmCaption ? (
          <p className="text-xs text-muted-foreground">{tape.ttmCaption}</p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={quarterlyMode ? "outline" : "secondary"}
          onClick={() => setQuarterlyMode(false)}
        >
          Annual
        </Button>
        <Button
          type="button"
          size="sm"
          variant={quarterlyMode ? "secondary" : "outline"}
          onClick={() => setQuarterlyMode(true)}
        >
          Quarterly
        </Button>
      </div>

      {quarterNote ? (
        <p className="text-sm text-muted-foreground">{quarterNote}</p>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          {quarterlyMode ? "Quarterly table" : "Annual table"}
        </h3>
        <TapeTable points={points} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Charts</h3>
        <TapeChart
          points={points}
          unit={tape.unit}
          unitLabel={tape.unitLabel}
          showDividends={tape.hasDividends}
        />
      </section>

      {missingList.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Missing</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {missingList.slice(0, 40).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Not investment advice. Tape uses warehouse filings only — missing series are skipped, not invented.
      </p>
    </div>
  );
}
