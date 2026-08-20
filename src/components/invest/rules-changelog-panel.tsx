"use client";

import { useMemo } from "react";
import { ScrollText } from "lucide-react";
import { RetirePanel } from "@/components/retirement/retire-ui";
import {
  mergeRulesChangelog,
  type RulesChangelogEntry,
} from "@/lib/invest/rules-changelog";

export function RulesChangelogPanel({
  stored,
}: {
  stored: RulesChangelogEntry[] | undefined;
}) {
  const entries = useMemo(() => mergeRulesChangelog(stored), [stored]);

  return (
    <RetirePanel>
      <div className="flex items-start gap-2 border-b border-border/60 px-5 py-4">
        <ScrollText className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">Rules changelog</h2>
          <p className="text-xs text-muted-foreground">
            Target mix, leftover, and util. Retired experiments stay visible.
          </p>
        </div>
      </div>
      <ol className="divide-y divide-border/60">
        {entries.map((entry) => (
          <li key={`${entry.source}-${entry.id}`} className="px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{entry.title}</p>
              <StatusChip entry={entry} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.at} · {areaLabel(entry.area)}
            </p>
            {entry.detail ? (
              <p className="mt-1 text-sm text-muted-foreground">{entry.detail}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </RetirePanel>
  );
}

function areaLabel(area: RulesChangelogEntry["area"]): string {
  if (area === "target-mix") return "Target mix";
  if (area === "leftover") return "Leftover";
  return "Util";
}

function StatusChip({ entry }: { entry: RulesChangelogEntry }) {
  const label =
    entry.status === "retired"
      ? "Retired"
      : entry.status === "logged"
        ? "Logged"
        : "Active";
  return (
    <span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground">
      {label}
    </span>
  );
}
