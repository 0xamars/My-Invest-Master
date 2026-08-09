/**
 * Cross-industry capital-path + FS metric audit.
 *   npx tsx --tsconfig tsconfig.json scripts/audit-business-path-fs.mts
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

const UNIVERSE = [
  "JPM",
  "BAC",
  "RY",
  "MFC",
  "MET",
  "PRU",
  "GS",
  "SCHW",
  "HOOD",
  "COIN",
  "O",
  "NEE",
  "AMT",
  "BLK",
  "BAM",
  "V",
  "MA",
  "XYZ",
  "SQ",
  "UPST",
  "TSLA",
  "F",
  "CAT",
  "MSFT",
  "AAPL",
  "NVDA",
  "UNH",
  "JNJ",
  "XOM",
  "RIVN",
  "ONDS",
  "SPY",
  "IBIT",
  "MSTR",
];

const { getAnalysisPackage } = await import(
  "../src/lib/market-data/warehouse/package.ts"
);
const { buildInvestSalsaRating } = await import(
  "../src/lib/analysis/rating/index.ts"
);

type Row = {
  symbol: string;
  industry: string;
  industryKey: string;
  path: string;
  vehicle: string;
  peerLabel: string;
  peerBasis: string;
  FS: string;
  profile: string;
  fragile: boolean;
  flags: string;
  cr: string;
  qr: string;
  cashDebt: string;
  ea: string;
  de: string;
  altman: string;
  problems: string[];
  fail: string[];
};

function met(
  metrics: Array<{
    id: string;
    value: number | null;
    score: number | null;
    skipped: boolean;
  }>,
  id: string,
): string {
  const m = metrics.find((x) => x.id === id);
  if (!m) return "—";
  const v =
    m.value == null
      ? "null"
      : Number.isFinite(m.value)
        ? m.value.toFixed(m.value >= 10 ? 1 : 3)
        : String(m.value);
  if (m.skipped || m.score == null) return `${v}/unscored`;
  return `${v}/s${Math.round(m.score)}`;
}

const rows: Row[] = [];

for (const symbol of UNIVERSE) {
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
    const vehicle = fund.nonOperatingVehicle
      ? `${fund.nonOperatingVehicle.kind}`
      : "opco";
    const fs = fund.pillars.find((p) => p.id === "financial_strength");
    const metrics = fs?.metrics ?? [];
    const flags = fund.classification.criticalFlags ?? [];
    const path = fund.classification.businessModel;
    const industry = f?.industry ?? pkg.profile?.industry ?? "—";
    const industryKey = f?.industryKey ?? pkg.profile?.industryKey ?? "—";
    const problems: string[] = [];
    const fail: string[] = [];

    const cr = metrics.find((m) => m.id === "current_ratio");
    const qr = metrics.find((m) => m.id === "quick_ratio");
    const cash = metrics.find((m) => m.id === "cash_to_debt");
    const crZeroish =
      f?.currentRatio != null && f.currentRatio <= 0.05;
    const qrZeroish = f?.quickRatio != null && f.quickRatio <= 0.05;

    if (["JPM", "BAC", "RY"].includes(symbol)) {
      if (path !== "bank_insurance") {
        fail.push(`A bank path=${path}`);
      }
      if (cr?.score != null || qr?.score != null || cash?.score != null) {
        fail.push("B bank CR/QR/cash scored");
      }
      if (flags.some((x) => /severe liquidity|impaired equity/i.test(x))) {
        fail.push(`C bank flag ${flags.join(",")}`);
      }
    }
    if (["MFC", "MET", "PRU"].includes(symbol)) {
      if (path !== "insurance_life") fail.push(`A insurance path=${path}`);
      if (cr?.score != null || qr?.score != null || cash?.score != null) {
        fail.push("B insurance CR/QR/cash scored");
      }
      if (fund.classification.growthProfile === "low_quality_fragile") {
        fail.push("C insurer falsely fragile");
      }
    }
    if (["HOOD", "COIN"].includes(symbol)) {
      if (path === "insurance_life") fail.push("A HOOD/COIN forced insurance_life");
    }
    if (["O", "AMT"].includes(symbol)) {
      if (vehicle !== "opco") fail.push(`A REIT blanked as ${vehicle}`);
      if (path !== "reit_utilities" && vehicle === "opco") {
        fail.push(`A REIT path=${path}`);
      }
    }
    if (["SPY", "IBIT"].includes(symbol)) {
      if (vehicle === "opco" && fund.available) {
        fail.push("A ETF scored as corporate FS");
      }
    }
    if (["MSFT", "AAPL", "NVDA"].includes(symbol)) {
      if ((fs?.score ?? 0) < 70) fail.push(`D quality FS low ${fs?.score}`);
      if (path !== "industry_peer") fail.push(`D quality path=${path}`);
    }
    if (symbol === "RIVN") {
      if (
        fund.classification.growthProfile !== "low_quality_fragile" &&
        (fs?.score ?? 100) > 55
      ) {
        fail.push("D RIVN not honestly weak");
      }
    }
    if (symbol === "MSTR") {
      if (path !== "treasury_holding") fail.push(`B MSTR path=${path}`);
    }
    if (["V", "MA"].includes(symbol) && path === "bank_insurance") {
      fail.push("A payments forced onto bank_insurance");
    }
    if (
      path === "brokerage_capital_markets" &&
      (crZeroish || qrZeroish) &&
      ((cr?.score != null && cr.score < 30) ||
        (qr?.score != null && qr.score < 30)) &&
      fund.classification.growthProfile === "low_quality_fragile"
    ) {
      fail.push("C broker CR/QR=0 drove fragile");
    }
    if (
      path === "reit_utilities" &&
      fund.peerContext?.label?.toLowerCase().includes("software")
    ) {
      fail.push("B REIT software peer frame");
    }

    if (
      (crZeroish || qrZeroish) &&
      (cr?.score != null && cr.score < 25 ||
        qr?.score != null && qr.score < 25) &&
      (path === "bank_insurance" ||
        path === "insurance_life" ||
        path === "brokerage_capital_markets")
    ) {
      problems.push("industrial CR/QR distress on financial path");
    }

    rows.push({
      symbol,
      industry: String(industry),
      industryKey: String(industryKey),
      path: vehicle !== "opco" ? `vehicle:${vehicle}` : path,
      vehicle,
      peerLabel: fund.peerContext?.label ?? fund.peerContext?.industry ?? "—",
      peerBasis: fund.peerContext?.basis ?? "—",
      FS: fund.available ? String(fs?.score ?? "n/a") : "n/a",
      profile: vehicle !== "opco" ? "—" : fund.classification.growthProfile,
      fragile:
        vehicle === "opco" &&
        fund.classification.growthProfile === "low_quality_fragile",
      flags: flags.join("|") || "—",
      cr: met(metrics, "current_ratio"),
      qr: met(metrics, "quick_ratio"),
      cashDebt: met(metrics, "cash_to_debt"),
      ea: met(metrics, "equity_to_assets"),
      de: met(metrics, "debt_to_equity"),
      altman: met(metrics, "altman_z"),
      problems,
      fail,
    });
    process.stderr.write(`… ${symbol}\n`);
  } catch (err) {
    rows.push({
      symbol,
      industry: "ERROR",
      industryKey: "—",
      path: "—",
      vehicle: "—",
      peerLabel: "—",
      peerBasis: "—",
      FS: "—",
      profile: "—",
      fragile: false,
      flags: err instanceof Error ? err.message : String(err),
      cr: "—",
      qr: "—",
      cashDebt: "—",
      ea: "—",
      de: "—",
      altman: "—",
      problems: [],
      fail: ["load error"],
    });
    process.stderr.write(`… ${symbol} ERROR\n`);
  }
}

console.log(
  [
    "symbol",
    "industry",
    "key",
    "path",
    "FS",
    "fragile",
    "flags",
    "CR",
    "QR",
    "cash/d",
    "E/A",
    "D/E",
    "Altman",
    "peers",
    "verdict",
    "fail",
  ].join("\t"),
);
for (const r of rows) {
  const verdict = r.fail.length ? "FAIL" : "PASS";
  console.log(
    [
      r.symbol,
      r.industry,
      r.industryKey,
      r.path,
      r.FS,
      r.fragile ? "YES" : "no",
      r.flags,
      r.cr,
      r.qr,
      r.cashDebt,
      r.ea,
      r.de,
      r.altman,
      `${r.peerBasis}:${r.peerLabel}`,
      verdict,
      r.fail.join("; ") || r.problems.join("; ") || "",
    ].join("\t"),
  );
}

console.log("\n=== FAIL DETAIL ===");
for (const r of rows.filter((x) => x.fail.length)) {
  console.log(`\n${r.symbol} [${r.industry} / ${r.industryKey}] path=${r.path} FS=${r.FS}`);
  console.log(`  flags=${r.flags} fragile=${r.fragile}`);
  console.log(`  CR=${r.cr} QR=${r.qr} cash=${r.cashDebt} EA=${r.ea} DE=${r.de} Z=${r.altman}`);
  console.log(`  peers=${r.peerBasis} ${r.peerLabel}`);
  for (const f of r.fail) console.log(`  FAIL: ${f}`);
}
