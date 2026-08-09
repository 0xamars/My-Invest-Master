/**
 * Narrative bundle smoke (OpenRouter once, then cache).
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-narrative.mts
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
      )
        v = v.slice(1, -1);
      if (!process.env[m[1]!]) process.env[m[1]!] = v;
    }
  } catch {
    /* ignore */
  }
}
loadEnv();

const symbol = (process.argv[2] || "TSLA").toUpperCase();

const { getAnalysisPackage } = await import(
  "../src/lib/market-data/warehouse/package.ts"
);
const { buildInvestSalsaRating } = await import(
  "../src/lib/analysis/rating/index.ts"
);
const { buildNarrativeContext } = await import(
  "../src/lib/analysis/narrative/context.ts"
);
const { getNarrativeBundle } = await import(
  "../src/lib/analysis/narrative/generate.ts"
);

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
const ctx = buildNarrativeContext({
  symbol,
  name: pkg.quote?.name ?? pkg.profile?.name,
  rating,
});

console.log("--- first ---");
const a = await getNarrativeBundle(ctx);
console.log("source", a.source, "model", a.model);
console.log("SUMMARY:\n", a.bundle.summary);
console.log("FS:", a.bundle.pillars.financialStrength);
console.log("OPPS:\n", a.bundle.futureOutlook.opportunities.map((x) => `- ${x}`).join("\n"));
console.log("RISKS:\n", a.bundle.futureOutlook.risks.map((x) => `- ${x}`).join("\n"));
const sentences = a.bundle.summary
  .split(/(?<=[.!?])\s+/)
  .filter((s) => s.replace(/[.!?]/g, "").trim().length > 12);
console.log("sentences", sentences.length);
console.log(
  "location?",
  /oversold|overbought|near fair|stretched|cooled off|washed out|pulled back/i.test(
    a.bundle.summary,
  ),
);
console.log(
  "advice?",
  /\b(buy now|sell now|good time to buy|accumulate|buy the fear)\b|\b(buy|sell) (this|the stock)\b/i.test(
    a.bundle.summary,
  ),
);
console.log(
  "meta?",
  /investsalsa analysis provides insights/i.test(a.bundle.summary),
);
console.log("summaryNums", (a.bundle.summary.match(/\b\d+\.\d+\b/g) ?? []).length);
console.log(
  "jargon?",
  /cash[- ]compounder|\bfranchise\b|\bTTM\b|optionality|reacceleration|earnings power|\bposture\b/i.test(
    [a.bundle.summary, a.bundle.pillars.financialStrength, a.bundle.fundamentalOverview].join(" "),
  ),
);

console.log("--- second ---");
const b = await getNarrativeBundle(ctx);
console.log("source", b.source, "model", b.model);
