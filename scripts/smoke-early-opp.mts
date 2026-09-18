/**
 * Live Early Opp smoke (needs FMP_API_KEY).
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-early-opp.mts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildEarlyOppPayload } from "../src/lib/analysis/early-opp/generate.ts";
import { EARLY_OPP_STEP_IDS } from "../src/lib/analysis/early-opp/steps.ts";

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

const symbols = process.argv.slice(2);
const list = symbols.length > 0 ? symbols : ["NVDA", "FLNC", "GOOGL"];

if (!process.env.FMP_API_KEY?.trim()) {
  console.error("FMP_API_KEY missing — cannot live-smoke Early Opp.");
  process.exit(2);
}

let failed = 0;
for (const symbol of list) {
  const started = Date.now();
  const result = await buildEarlyOppPayload(symbol);
  const ms = Date.now() - started;
  if ("error" in result) {
    failed += 1;
    console.error(`FAIL ${symbol}: ${result.error} (${ms}ms)`);
    continue;
  }
  const ids = result.steps.map((step) => step.id);
  const missing = EARLY_OPP_STEP_IDS.filter((id) => !ids.includes(id));
  const invented = result.steps.flatMap((step) =>
    step.numbers.filter((n) => n.source !== "fmp" || (n.kind !== "text" && n.value == null)),
  );
  const ok =
    result.steps.length === 16 &&
    missing.length === 0 &&
    invented.length === 0 &&
    Boolean(result.quote.symbol);
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${symbol}: steps=${result.steps.length} missing=${missing.join(",")} invented=${invented.length}`);
    continue;
  }
  const counts = `${result.counts.pass}p/${result.counts.soft}s/${result.counts.fail}f/${result.counts.unknown}u`;
  console.log(
    `ok ${symbol} ${counts} price=${result.quote.price ?? "unknown"} ai=${result.meta.ai.source} (${ms}ms)`,
  );
  for (const step of result.steps) {
    const nums = step.numbers.map((n) => `${n.label}=${n.display}`).join("; ");
    console.log(`  ${String(step.number).padStart(2, "0")} ${step.status.padEnd(7)} ${step.title}${nums ? ` · ${nums}` : ""}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} symbol(s) failed`);
  process.exit(1);
}
console.log("\nearly-opp live smoke ok");
