/**
 * Company blurb quality smoke.
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-company-blurb.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  finalizeCompanyBlurb,
  truncateProfileDescription,
} from "../src/lib/analysis/company-blurb.ts";

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

const teslaProfile =
  "Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems in the United States, China, and internationally. The company operates in two segments, Automotive, and Energy Generation and Storage. It also offers vehicle service centers, supercharger stations, and in-app upgrades.";

const meta =
  "InvestSalsa Analysis provides insights into companies like Tesla. Tesla, Inc. is in the Consumer Cyclical sector and Auto Manufacturers industry.";

const fallback = truncateProfileDescription(teslaProfile);
const stripped = finalizeCompanyBlurb(meta, fallback);

console.log("fallback:", fallback);
console.log("meta→", stripped.source, stripped.blurb);
console.log(
  "fallbackHasInvestSalsa=",
  /investsalsa/i.test(fallback ?? ""),
);
console.log(
  "strippedHasInvestSalsa=",
  /investsalsa|provides insights/i.test(stripped.blurb ?? ""),
);

const key = Boolean(process.env.OPENROUTER_API_KEY?.trim());
console.log("OPENROUTER_CONFIGURED=", key);
if (!key) process.exit(0);

const { complete } = await import("../src/lib/ai/client.ts");
const {
  COMPANY_BLURB_RETRY_SYSTEM,
  COMPANY_BLURB_SYSTEM,
  buildCompanyBlurbUserMessage,
} = await import("../src/lib/ai/prompts/company-blurb.ts");

const user = buildCompanyBlurbUserMessage({
  symbol: "TSLA",
  name: "Tesla, Inc.",
  sector: "Consumer Cyclical",
  industry: "Auto Manufacturers",
  country: "US",
  description: teslaProfile,
});

const first = await complete({
  feature: "analysis.company_blurb",
  system: COMPANY_BLURB_SYSTEM,
  messages: [{ role: "user", content: user }],
});
let decided = finalizeCompanyBlurb(first.text, fallback);
if (decided.source !== "ai") {
  const retry = await complete({
    feature: "analysis.company_blurb",
    system: COMPANY_BLURB_RETRY_SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  decided = finalizeCompanyBlurb(retry.text, fallback);
}

console.log("live source=", decided.source);
console.log("live blurb=", decided.blurb);
const bad = /investsalsa|provides insights|this analysis/i.test(
  decided.blurb ?? "",
);
console.log("liveHasMeta=", bad);
if (bad || !decided.blurb) process.exit(1);
