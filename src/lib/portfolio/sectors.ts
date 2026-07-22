import type { AssetCatalogItem, AssetType } from "@/types/portfolio";

/** Dropdown options for sector classification (pie charts, table). */
export const PREDEFINED_SECTORS = [
  "AI Tech",
  "Semiconductor",
  "Software",
  "E-commerce",
  "Health",
  "Finance",
  "Consumer",
  "Energy",
  "Space",
  "Quantum",
  "Drones",
  "Robotics",
  "Crypto",
  "Blockchain",
  "Biotechnology",
  "Renewable Energy",
  "Defense",
  "Automotive",
  "Entertainment",
  "Real Estate",
  "Industrial",
  "ETFs & Index",
  "Cash & Liquidity",
  "Other",
] as const;

export type PredefinedSector = (typeof PREDEFINED_SECTORS)[number];

export const CUSTOM_SECTOR_VALUE = "__custom__";

export const SECTOR_CASH = "Cash & Liquidity" satisfies PredefinedSector;
export const SECTOR_CRYPTO = "Crypto" satisfies PredefinedSector;
export const SECTOR_BLOCKCHAIN = "Blockchain" satisfies PredefinedSector;
export const SECTOR_OTHER = "Other" satisfies PredefinedSector;

const SECTOR_LOOKUP = new Map(
  PREDEFINED_SECTORS.map((sector) => [sector.toLowerCase(), sector]),
);

/** Legacy names and common aliases → canonical sector. */
const SECTOR_ALIASES: Record<string, PredefinedSector> = {
  cryptocurrency: SECTOR_CRYPTO,
  "financial services": "Finance",
  biotech: "Biotechnology",
};

const SEARCH_HINT_RULES: { match: RegExp; sector: PredefinedSector }[] = [
  { match: /\bai\b|artificial intelligence|machine learning/i, sector: "AI Tech" },
  { match: /semiconductor|chip/i, sector: "Semiconductor" },
  { match: /software|saas|technology|tech/i, sector: "Software" },
  { match: /e-?commerce|retail|internet retail/i, sector: "E-commerce" },
  { match: /healthcare|pharma|medical|hospital/i, sector: "Health" },
  { match: /biotech|biotechnology|genomic|life science/i, sector: "Biotechnology" },
  { match: /financial|bank|insurance|fintech|capital market/i, sector: "Finance" },
  { match: /consumer|staples|discretionary|household/i, sector: "Consumer" },
  { match: /renewable|solar|wind power|clean energy/i, sector: "Renewable Energy" },
  { match: /energy|oil|gas|utility|utilities|power/i, sector: "Energy" },
  { match: /space|aerospace|satellite|orbit/i, sector: "Space" },
  { match: /quantum|qubit/i, sector: "Quantum" },
  { match: /drone|uav|unmanned/i, sector: "Drones" },
  { match: /robot|automation|autonomous/i, sector: "Robotics" },
  { match: /blockchain|web3|defi|decentralized/i, sector: "Blockchain" },
  { match: /crypto|bitcoin|ethereum|digital asset/i, sector: "Crypto" },
  { match: /defense|military|weapon|security/i, sector: "Defense" },
  { match: /automotive|auto|ev\b|electric vehicle|car maker/i, sector: "Automotive" },
  { match: /entertainment|media|streaming|gaming|film/i, sector: "Entertainment" },
  { match: /real estate|reit|property/i, sector: "Real Estate" },
  { match: /industrial|manufacturing|machinery/i, sector: "Industrial" },
  { match: /etf|index|mutual fund/i, sector: "ETFs & Index" },
];

export function normalizeSector(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return SECTOR_OTHER;

  const canonical =
    SECTOR_LOOKUP.get(trimmed.toLowerCase()) ??
    SECTOR_ALIASES[trimmed.toLowerCase()];

  return canonical ?? trimmed;
}

export function isPredefinedSector(value: string): value is PredefinedSector {
  return PREDEFINED_SECTORS.includes(normalizeSector(value) as PredefinedSector);
}

export function getDefaultSectorForType(type: AssetType): string {
  switch (type) {
    case "crypto":
      return SECTOR_CRYPTO;
    case "cash":
      return SECTOR_CASH;
    case "custom":
      return SECTOR_OTHER;
    default:
      return SECTOR_OTHER;
  }
}

export function mapSearchHintToSector(hint?: string): string {
  if (!hint) return SECTOR_OTHER;

  const normalized = normalizeSector(hint);
  if (isPredefinedSector(normalized)) return normalized;

  for (const rule of SEARCH_HINT_RULES) {
    if (rule.match.test(hint)) return rule.sector;
  }

  return normalized;
}

export function suggestSectorFromCatalog(asset: AssetCatalogItem): string {
  if (asset.type === "crypto") return SECTOR_CRYPTO;
  if (asset.category === "ETF") return "ETFs & Index";
  return mapSearchHintToSector(asset.subCategory || asset.category);
}

export function resolveSectorChoice(
  choice: string,
  customValue: string,
): string | null {
  if (choice === CUSTOM_SECTOR_VALUE) {
    const trimmed = customValue.trim();
    return trimmed ? normalizeSector(trimmed) : null;
  }
  return normalizeSector(choice);
}

export function toSectorChoiceValue(sector: string): {
  choice: string;
  customValue: string;
} {
  const normalized = normalizeSector(sector);
  if (PREDEFINED_SECTORS.includes(normalized as PredefinedSector)) {
    return { choice: normalized, customValue: "" };
  }
  return { choice: CUSTOM_SECTOR_VALUE, customValue: normalized };
}

/** Migrate legacy holdings that only have category / subCategory. */
export function resolveHoldingSector(holding: {
  sector?: string;
  type: AssetType;
  category?: string;
  subCategory?: string;
}): string {
  if (holding.sector?.trim()) {
    return normalizeSector(holding.sector);
  }
  if (holding.type === "cash") return SECTOR_CASH;
  if (holding.type === "crypto") return SECTOR_CRYPTO;
  return mapSearchHintToSector(holding.subCategory ?? holding.category);
}

export function getSectorSelectOptions(type: AssetType): readonly string[] {
  if (type === "cash") {
    return [SECTOR_CASH];
  }
  return PREDEFINED_SECTORS.filter((sector) => sector !== SECTOR_CASH);
}

export function filterSectorOptions(
  options: readonly string[],
  query: string,
): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...options];

  return options.filter((sector) =>
    sector.toLowerCase().includes(normalizedQuery),
  );
}

export function canCreateCustomSector(
  options: readonly string[],
  query: string,
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  return !options.some((sector) => sector.toLowerCase() === lower);
}
