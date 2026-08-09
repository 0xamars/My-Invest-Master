/**
 * Discover distinct warehouse/FMP industries and assign path families.
 *   npx tsx --tsconfig tsconfig.json scripts/discover-industry-paths.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2]!;
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]!]) process.env[m[1]!] = v;
    }
  } catch {
    /* ignore */
  }
}
loadEnv();

const { createAdminClient } = await import("../src/lib/supabase/admin.ts");
const { INDUSTRY_PEER_SEEDS } = await import(
  "../src/lib/analysis/rating/peer-universe.ts"
);
const {
  classifyCapitalProfile,
  fsPolicyNote,
  isFinancialIntermediaryIndustry,
  isReitOrUtilityIndustry,
  isInsuranceIndustry,
  isBankIndustry,
  isPaymentOrCreditRailIndustry,
} = await import("../src/lib/analysis/rating/industry-model.ts");
const { toIndustryKey } = await import("../src/lib/market-data/industry-overrides.ts");
const { getAnalysisPackage } = await import(
  "../src/lib/market-data/warehouse/package.ts"
);
const { buildInvestSalsaRating } = await import(
  "../src/lib/analysis/rating/index.ts"
);

type Row = {
  industry: string;
  key: string;
  sector: string;
  path: string;
  example: string;
  note: string;
  flag: string;
};

const seen = new Map<string, Row>();

function addIndustry(
  industry: string | null,
  sector: string | null,
  example = "",
) {
  if (!industry?.trim()) return;
  const key = toIndustryKey(industry) ?? "";
  const id = `${industry}|${key}`;
  if (seen.has(id)) {
    const prev = seen.get(id)!;
    if (!prev.example && example) prev.example = example;
    return;
  }
  const path = classifyCapitalProfile({
    industryKey: key,
    sectorKey: toIndustryKey(sector),
    industry,
    sector,
    profitMargins: 0.1,
    operatingMargins: 0.12,
    freeCashflow: 1e9,
    revenueGrowth: 0.05,
  });
  const ref = { industryKey: key, industry, sectorKey: toIndustryKey(sector), sector };
  const looksOverlay =
    (isFinancialIntermediaryIndustry(ref) ||
      isReitOrUtilityIndustry(ref) ||
      isInsuranceIndustry(ref) ||
      isBankIndustry(ref)) &&
    !isPaymentOrCreditRailIndustry(ref);
  const flag =
    path === "industry_peer" && looksOverlay
      ? "CHECK: financial/REIT/utility still industry_peer"
      : "";
  seen.set(id, {
    industry,
    key,
    sector: sector ?? "",
    path,
    example,
    note: fsPolicyNote(path),
    flag,
  });
}

for (const [key, syms] of Object.entries(INDUSTRY_PEER_SEEDS)) {
  const label = key
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  addIndustry(label, null, syms[0] ?? "");
}

const sb = createAdminClient();
if (sb) {
  const { data, error } = await sb
    .from("company_profiles")
    .select("symbol, industry, sector")
    .not("industry", "is", null)
    .limit(2000);
  if (error) {
    console.error("warehouse industry query skipped:", error.message);
  } else {
    for (const row of data ?? []) {
      addIndustry(
        (row.industry as string | null) ?? null,
        (row.sector as string | null) ?? null,
        (row.symbol as string | null) ?? "",
      );
    }
  }
}

const extraSmoke = [
  "CB",
  "TRV",
  "WFC",
  "USB",
  "T",
  "VZ",
  "AVGO",
  "AMD",
  "GILD",
  "AMZN",
  "WMT",
  "FCX",
  "DAL",
  "NLY",
  "O",
  "HOOD",
  "COIN",
  "V",
  "MA",
  "MSFT",
  "TSLA",
  "RIVN",
  "SPY",
  "IBIT",
  "MFC",
];

console.log("=== EXTRA SMOKE ===");
for (const symbol of extraSmoke) {
  try {
    const pkg = await getAnalysisPackage(symbol, { includeHourly: false });
    const rating = buildInvestSalsaRating({
      assetType: "stock",
      price: pkg.quote?.price ?? null,
      ath: pkg.ath,
      fundamentals: pkg.fundamentals,
      peers: pkg.peers,
      peerContext: pkg.peerContext,
      dailyBars: pkg.dailyBars,
      hourlyBars: pkg.hourlyBars,
      symbol,
      vehicleProfile: pkg.profile,
    });
    const fund = rating.fundamental;
    const f = pkg.fundamentals;
    addIndustry(f?.industry ?? pkg.profile?.industry ?? null, f?.sector ?? pkg.profile?.sector ?? null, symbol);
    const vehicle = fund.nonOperatingVehicle?.kind ?? "opco";
    const fs = fund.pillars.find((p) => p.id === "financial_strength");
    const cr = fs?.metrics.find((m) => m.id === "current_ratio");
    console.log(
      [
        symbol,
        f?.industry ?? pkg.profile?.industry,
        vehicle !== "opco" ? `vehicle:${vehicle}` : fund.classification.businessModel,
        `FS=${fund.available ? fs?.score : "n/a"}`,
        fund.classification.growthProfile,
        `CR=${cr ? (cr.skipped ? "unscored" : cr.score) : "—"}`,
        fund.classification.criticalFlags.join("|") || "—",
      ].join("\t"),
    );
  } catch (err) {
    console.log(symbol, "ERROR", err instanceof Error ? err.message : err);
  }
}

const rows = [...seen.values()].sort((a, b) =>
  a.path === b.path
    ? a.industry.localeCompare(b.industry)
    : a.path.localeCompare(b.path),
);

console.log("\n=== INDUSTRY → PATH ===");
console.log(["path", "industry", "key", "example", "policy", "flag"].join("\t"));
for (const r of rows) {
  console.log(
    [r.path, r.industry, r.key, r.example, r.note, r.flag].join("\t"),
  );
}

const checks = rows.filter((r) => r.flag);
console.log(`\nIndustries mapped: ${rows.length}`);
console.log(`CHECK flags: ${checks.length}`);
for (const r of checks) {
  console.log(`  ${r.industry} (${r.key}) example=${r.example}`);
}
