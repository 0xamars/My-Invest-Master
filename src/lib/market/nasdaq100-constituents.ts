import { fetchSp500Constituents } from "@/lib/market/sp500-constituents";
import { parseCsvLine, toYahooSymbol } from "@/lib/market/csv";
import { inferIndexSector } from "@/lib/market/infer-sector";
import type { IndexConstituent } from "@/lib/market/index-config";
import {
  stripBom,
  unliftedqCsvUrl,
} from "@/lib/market/unliftedq-csv";

const CONSTITUENTS_TTL_MS = 60 * 60 * 1000;

let constituentsCache: {
  data: IndexConstituent[];
  fetchedAt: number;
} | null = null;

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

async function buildSectorLookup(): Promise<Map<string, IndexConstituent>> {
  const sp500 = await fetchSp500Constituents();
  return new Map(sp500.map((entry) => [entry.symbol, entry]));
}

async function downloadNasdaq100(): Promise<IndexConstituent[]> {
  const response = await fetch(unliftedqCsvUrl("nasdaq100"), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download NASDAQ 100 constituents (${response.status})`,
    );
  }

  const csv = await response.text();
  const rows = parseUnliftedqCsv(csv);

  if (rows.length < 90) {
    throw new Error("NASDAQ 100 constituents list looks incomplete.");
  }

  const sectorLookup = await buildSectorLookup();

  return rows.map((row) => {
    const sp500Entry = sectorLookup.get(row.symbol);

    return {
      symbol: row.symbol,
      yahooSymbol: toYahooSymbol(row.symbol),
      name: row.name,
      sector: sp500Entry?.sector ?? inferIndexSector(row.name),
      industry: sp500Entry?.industry ?? "Diversified",
    };
  });
}

export async function fetchNasdaq100Constituents(): Promise<IndexConstituent[]> {
  if (
    constituentsCache &&
    Date.now() - constituentsCache.fetchedAt < CONSTITUENTS_TTL_MS
  ) {
    return constituentsCache.data;
  }

  const data = await downloadNasdaq100();
  constituentsCache = { data, fetchedAt: Date.now() };
  return data;
}

export function getNasdaq100Metadata(symbol: string): {
  sector: string;
  industry: string;
} {
  const normalized = symbol.trim().toUpperCase();
  const entry = constituentsCache?.data.find(
    (item) => item.symbol === normalized || item.yahooSymbol === normalized,
  );

  return entry
    ? { sector: entry.sector, industry: entry.industry }
    : { sector: "Technology", industry: "Diversified" };
}
