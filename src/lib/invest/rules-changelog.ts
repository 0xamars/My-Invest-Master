import seed from "./data/rules-changelog.json";
import type { TargetAllocation } from "@/types/portfolio";
import type { PortfolioLeverage } from "@/lib/portfolio/leverage";

export const RULES_CHANGELOG_AREAS = [
  "target-mix",
  "leftover",
  "util",
] as const;

export type RulesChangelogArea = (typeof RULES_CHANGELOG_AREAS)[number];

export type RulesChangelogStatus = "active" | "retired" | "logged";

export type RulesChangelogEntry = {
  id: string;
  at: string;
  area: RulesChangelogArea;
  title: string;
  detail: string;
  status: RulesChangelogStatus;
  source: "seed" | "live";
};

const MAX_TITLE = 120;
const MAX_DETAIL = 400;

function asArea(value: unknown): RulesChangelogArea | null {
  return RULES_CHANGELOG_AREAS.includes(value as RulesChangelogArea)
    ? (value as RulesChangelogArea)
    : null;
}

function asStatus(value: unknown): RulesChangelogStatus {
  if (value === "retired" || value === "logged" || value === "active") {
    return value;
  }
  return "active";
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function parseRulesChangelogEntry(
  raw: unknown,
  source: "seed" | "live" = "live",
): RulesChangelogEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const area = asArea(data.area);
  const id = clip(data.id, 80);
  const at = clip(data.at, 40);
  const title = clip(data.title, MAX_TITLE);
  const detail = clip(data.detail, MAX_DETAIL);
  if (!area || !id || !at || !title) return null;
  return {
    id,
    at,
    area,
    title,
    detail,
    status: asStatus(data.status),
    source,
  };
}

export function parseStoredRulesChangelog(value: unknown): RulesChangelogEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: RulesChangelogEntry[] = [];
  for (const item of value) {
    const parsed = parseRulesChangelogEntry(item, "live");
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    entries.push(parsed);
  }
  return entries;
}

export function seedRulesChangelog(): RulesChangelogEntry[] {
  return seed
    .map((item) => parseRulesChangelogEntry(item, "seed"))
    .filter((item): item is RulesChangelogEntry => item != null);
}

/**
 * Seed stays visible (including retired). Live entries overlay.
 * A newer live rule for the same area retires older active rules for display.
 */
export function mergeRulesChangelog(
  stored: RulesChangelogEntry[] | undefined,
): RulesChangelogEntry[] {
  const live = stored ?? [];
  const merged = [...seedRulesChangelog(), ...live];
  const latestLiveAt = new Map<RulesChangelogArea, string>();
  for (const entry of live) {
    if (entry.status === "logged") continue;
    const current = latestLiveAt.get(entry.area);
    if (!current || entry.at >= current) latestLiveAt.set(entry.area, entry.at);
  }

  const visible = merged.map((entry) => {
    if (entry.status === "logged" || entry.status === "retired") return entry;
    const newer = latestLiveAt.get(entry.area);
    if (newer && entry.at < newer) {
      return { ...entry, status: "retired" as const };
    }
    return entry;
  });

  return visible.sort((a, b) => {
    const date = b.at.localeCompare(a.at);
    if (date !== 0) return date;
    return a.title.localeCompare(b.title);
  });
}

export function appendRulesChangelog(
  stored: RulesChangelogEntry[] | undefined,
  entry: Omit<RulesChangelogEntry, "source">,
): RulesChangelogEntry[] {
  const next = parseRulesChangelogEntry({ ...entry }, "live");
  if (!next) return stored ?? [];
  const previous = (stored ?? []).map((item) => {
    if (
      item.area === next.area &&
      item.status === "active" &&
      next.status === "active"
    ) {
      return { ...item, status: "retired" as const };
    }
    return item;
  });
  if (previous.some((item) => item.id === next.id)) {
    return previous.map((item) => (item.id === next.id ? next : item));
  }
  return [...previous, next];
}

export function targetMixChangelogDetail(targets: TargetAllocation): string {
  return `Stocks ${Math.round(targets.stock)} · crypto ${Math.round(targets.crypto)} · cash ${Math.round(targets.cash)} · custom ${Math.round(targets.custom)}. No auto-trades.`;
}

export function leftoverChangelogDetail(amountLabel: string): string {
  return `Added ${amountLabel} as cash on the primary book. Budget leftover is unchanged.`;
}

export function utilChangelogDetail(leverage: PortfolioLeverage): string {
  const bits: string[] = [];
  if (leverage.marginUsed != null) {
    bits.push(`Margin used ${leverage.marginUsed}`);
  }
  if (leverage.equity != null) {
    bits.push(`typed equity ${leverage.equity}`);
  }
  if (bits.length === 0) {
    return "Util figures cleared. Missing inputs stay blank.";
  }
  return `${bits.join(" · ")}. Caution 50% / high 70%.`;
}
