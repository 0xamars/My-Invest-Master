/**
 * Compact package facts for Future Outlook grounding.
 * Display strings only — never invent values the pillars do not already show.
 */
import type { InvestSalsaRating, MetricScore } from "@/lib/analysis/rating/types";
import type { NarrativePackageFact } from "@/lib/analysis/narrative/types";

const OUTLOOK_METRIC_IDS = [
  "revenue_growth",
  "operating_income_growth",
  "eps_growth",
  "fcf_growth",
  "revenue_growth_3y",
  "revenue_estimate_growth",
  "eps_estimate_growth",
  "gross_margin",
  "operating_margin",
  "net_margin",
  "ebitda_margin",
  "fcf_margin",
  "fcf_level",
  "fcf_to_debt",
  "cash_to_debt",
  "net_debt_ebitda",
  "debt_to_equity",
  "interest_coverage",
  "pe_ttm",
  "pe_forward",
  "p_s",
  "ev_sales",
  "fcf_yield",
  "p_fcf",
  "sbc_to_revenue",
] as const;

const MAX_FACTS = 14;

function displayOf(m: MetricScore): string | null {
  const d = m.display?.replace(/\s+/g, " ").trim();
  return d ? d.slice(0, 24) : null;
}

function cleanLabel(label: string): string {
  return label
    .replace(/\s*\(TTM\)/gi, "")
    .replace(/\bTTM\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractPackageFacts(
  rating: InvestSalsaRating,
): NarrativePackageFact[] {
  const wanted = new Set<string>(OUTLOOK_METRIC_IDS);
  const byId = new Map<string, MetricScore>();
  for (const pillar of rating.fundamental.pillars) {
    for (const m of pillar.metrics) {
      if (!wanted.has(m.id)) continue;
      if (m.skipped && m.display == null) continue;
      if (!byId.has(m.id)) byId.set(m.id, m);
    }
  }
  const out: NarrativePackageFact[] = [];
  for (const id of OUTLOOK_METRIC_IDS) {
    const m = byId.get(id);
    if (!m) continue;
    const display = displayOf(m);
    if (!display) continue;
    out.push({ id: m.id, label: cleanLabel(m.label) || m.label, display });
    if (out.length >= MAX_FACTS) break;
  }
  return out;
}

export function factDisplay(
  facts: NarrativePackageFact[] | undefined,
  id: string,
): string | null {
  const hit = facts?.find((f) => f.id === id);
  return hit?.display ?? null;
}

export function packageFactsHaveNumbers(
  facts: Array<{ display: string }> | undefined,
): boolean {
  if (!facts || facts.length < 3) return false;
  return facts.filter((f) => /\d/.test(f.display)).length >= 3;
}
