import { parseCsvLine, toYahooSymbol } from "@/lib/market/csv";
import { inferIndexSector } from "@/lib/market/infer-sector";
import type { IndexConstituent } from "@/lib/market/index-config";
import {
  stripBom,
  unliftedqCsvUrl,
} from "@/lib/market/unliftedq-csv";

const GICS_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv";

const CONSTITUENTS_TTL_MS = 60 * 60 * 1000;

const GICS_SECTOR_MAP: Record<string, string> = {
  "Information Technology": "Technology",
  "Health Care": "Healthcare",
  Financials: "Financial",
  "Consumer Discretionary": "Consumer Cyclical",
  "Consumer Staples": "Consumer Defensive",
  Materials: "Basic Materials",
  "Real Estate": "Real Estate",
  "Communication Services": "Communication Services",
  Utilities: "Utilities",
  Energy: "Energy",
  Industrials: "Industrials",
};

export type Sp500Constituent = IndexConstituent;

let constituentsCache: {
  data: Sp500Constituent[];
  fetchedAt: number;
} | null = null;

export function normalizeSp500Sector(gicsSector: string): string {
  return GICS_SECTOR_MAP[gicsSector.trim()] ?? gicsSector.trim();
}

export { toYahooSymbol } from "@/lib/market/csv";

function parseUnliftedqCsv(csv: string): { symbol: string; name: string }[] {
  const lines = stripBom(csv).split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const rows: { symbol: string; name: string }[] = [];

  for (const line of lines.slice(1)) {
    const [symbol, name] = parseCsvLine(line);
    if (!symbol) continue;

    rows.push({
      symbol: symbol.trim().toUpperCase(),
      name: name?.trim() || symbol.trim().toUpperCase(),
    });
  }

  return rows;
}

function parseGicsLookup(csv: string): Map<
  string,
  { name: string; sector: string; industry: string }
> {
  const lines = stripBom(csv).split(/\r?\n/).filter(Boolean);
  const map = new Map<string, { name: string; sector: string; industry: string }>();

  for (const line of lines.slice(1)) {
    const [symbol, name, gicsSector, gicsIndustry] = parseCsvLine(line);
    if (!symbol || !gicsSector) continue;

    const normalizedSymbol = symbol.trim().toUpperCase();
    map.set(normalizedSymbol, {
      name: name?.trim() || normalizedSymbol,
      sector: normalizeSp500Sector(gicsSector),
      industry: gicsIndustry?.trim() || "Diversified",
    });
  }

  return map;
}

async function downloadConstituents(): Promise<Sp500Constituent[]> {
  const [membershipResponse, gicsResponse] = await Promise.all([
    fetch(unliftedqCsvUrl("sp500"), { cache: "no-store" }),
    fetch(GICS_URL, { cache: "no-store" }),
  ]);

  if (!membershipResponse.ok) {
    throw new Error(
      `Failed to download S&P 500 membership (${membershipResponse.status})`,
    );
  }

  const membershipCsv = await membershipResponse.text();
  const membershipRows = parseUnliftedqCsv(membershipCsv);

  if (membershipRows.length < 400) {
    throw new Error("S&P 500 membership list looks incomplete.");
  }

  const gicsLookup = gicsResponse.ok
    ? parseGicsLookup(await gicsResponse.text())
    : new Map<string, { name: string; sector: string; industry: string }>();

  return membershipRows.map((row) => {
    const gics = gicsLookup.get(row.symbol);

    return {
      symbol: row.symbol,
      yahooSymbol: toYahooSymbol(row.symbol),
      name: gics?.name ?? row.name,
      sector: gics?.sector ?? inferIndexSector(row.name),
      industry: gics?.industry ?? "Diversified",
    };
  });
}

export async function fetchSp500Constituents(): Promise<Sp500Constituent[]> {
  if (
    constituentsCache &&
    Date.now() - constituentsCache.fetchedAt < CONSTITUENTS_TTL_MS
  ) {
    return constituentsCache.data;
  }

  const data = await downloadConstituents();
  constituentsCache = { data, fetchedAt: Date.now() };
  return data;
}

export function getStockMetadata(symbol: string): {
  sector: string;
  industry: string;
} {
  const normalized = symbol.trim().toUpperCase();
  const entry = constituentsCache?.data.find(
    (item) => item.symbol === normalized || item.yahooSymbol === normalized,
  );

  return entry
    ? { sector: entry.sector, industry: entry.industry }
    : { sector: "Other", industry: "Diversified" };
}
