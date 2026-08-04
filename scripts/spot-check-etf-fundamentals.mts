/**
 * Spot-check non-operating vehicle fundamentals path.
 *   npx tsx --tsconfig tsconfig.json scripts/spot-check-etf-fundamentals.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let val = m[2]!;
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]!]) process.env[m[1]!] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvLocal();

const { getAnalysisPackage } = await import(
  "../src/lib/market-data/warehouse/package.ts"
);
const { buildInvestSalsaRating } = await import(
  "../src/lib/analysis/rating/index.ts"
);
const { detectNonOperatingVehicle } = await import(
  "../src/lib/analysis/rating/non-operating-vehicle.ts"
);

const TICKERS = ["IBIT", "MSFT", "AMZN", "TSLA"] as const;

for (const symbol of TICKERS) {
  const pkg = await getAnalysisPackage(symbol, { includeHourly: false });
  const vehicle = detectNonOperatingVehicle(
    pkg.profile
      ? {
          name: pkg.profile.name,
          industry: pkg.profile.industry,
          industryKey: pkg.profile.industryKey,
          sector: pkg.profile.sector,
          description: pkg.profile.description,
          isEtf: pkg.profile.isEtf,
          isFund: pkg.profile.isFund,
          raw: pkg.profile.raw,
        }
      : null,
  );
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
    vehicleProfile: pkg.profile
      ? {
          name: pkg.profile.name,
          industry: pkg.profile.industry,
          industryKey: pkg.profile.industryKey,
          sector: pkg.profile.sector,
          description: pkg.profile.description,
          isEtf: pkg.profile.isEtf,
          isFund: pkg.profile.isFund,
          raw: pkg.profile.raw,
        }
      : null,
  });
  const f = rating.fundamental;
  console.log(
    [
      symbol,
      `vehicle=${vehicle.isNonOperating ? vehicle.kind : "operating"}`,
      `avail=${f.available}`,
      `F=${f.score ?? "N/A"}`,
      `pillars=${f.pillars.length}`,
      `profile=${f.classification.growthProfileLabel}`,
      `T=${rating.technical.score ?? "—"}`,
      `overall=${rating.score ?? "—"}`,
      f.nonOperatingVehicle?.message?.slice(0, 90) ?? "—",
    ].join(" | "),
  );
}
