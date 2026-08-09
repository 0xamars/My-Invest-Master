/**
 * Narrative bundle smoke (OpenRouter once, then cache).
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-narrative.mts
 *   npx tsx --tsconfig tsconfig.json scripts/smoke-narrative.mts TSLA MSFT MFC RIVN
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

const symbols = (process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["TSLA", "MSFT", "MFC", "RIVN"]
).map((s) => s.toUpperCase());

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

for (const symbol of symbols) {
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
    description: pkg.profile?.description ?? null,
    rating,
    recentEvents: pkg.recentEvents ?? [],
  });

  console.log(`\n======== ${symbol} first ========`);
  const a = await getNarrativeBundle(ctx);
  console.log("source", a.source, "model", a.model);
  console.log("industry", ctx.industry, "path", ctx.path);
  console.log("sbcBurden", ctx.sbcBurden, "sbcToRev", pkg.fundamentals?.sbcToRevenue);
  console.log("valBasis", ctx.valuationLanguage.basis, "fwdPE", pkg.fundamentals?.forwardPE);
  console.log("FUND_HDR:", a.bundle.fundamentalOverview);
  console.log("VAL:", a.bundle.pillars.valuation);
  console.log("events", JSON.stringify(pkg.recentEvents ?? []));
  console.log(
    "BULLETS:\n",
    (a.bundle.summaryBullets?.length
      ? a.bundle.summaryBullets
      : [a.bundle.summary]
    )
      .map((x) => `- ${x}`)
      .join("\n"),
  );
  console.log("FS:", a.bundle.pillars.financialStrength);
  console.log("G:", a.bundle.pillars.growth);
  console.log(
    "OPPS:\n",
    a.bundle.futureOutlook.opportunities.map((x) => `- ${x}`).join("\n"),
  );
  console.log(
    "RISKS:\n",
    a.bundle.futureOutlook.risks.map((x) => `- ${x}`).join("\n"),
  );
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
    "genericOpen?",
    /\b(paints a mixed picture|the picture is mixed|looks mixed:|shaky overall)\b/i.test(
      a.bundle.summary,
    ),
  );
  const ident = `${a.bundle.summary} ${a.bundle.futureOutlook.opportunities.join(" ")}`;
  const opps = a.bundle.futureOutlook.opportunities.join(" ");
  const risks = a.bundle.futureOutlook.risks.join(" ");
  const filingInSummary = (
    a.bundle.summaryBullets?.length ? a.bundle.summaryBullets : [a.bundle.summary]
  ).filter((b) =>
    /net insider|insiders?\b[\s\S]{0,48}\b(buying|selling|sellers|sales)|open-market (sales?|selling)|agreed to acquire/i.test(
      b,
    ),
  ).length;
  console.log(
    "namedBiz?",
    /tesla|ev|auto|robot|energy|microsoft|cloud|ai|manulife|insur|life|asia|rivian|burn|delivery/i.test(
      ident,
    ),
  );
  console.log("filingBullets", filingInSummary);
  console.log(
    "outlookFilingEcho?",
    /net insider|insider (buying|selling)|agreed to acquire/i.test(
      `${opps} ${risks}`,
    ),
  );
  if (symbol === "TSLA") {
    console.log("tslaEnergy?", /energy|storage/i.test(opps));
    console.log("tslaAutonomy?", /autonom|robotaxi|self-driv/i.test(opps));
    console.log("tslaHumanoid?", /humanoid|optimus|robot/i.test(opps));
    console.log(
      "tslaRisk?",
      /price|rival|compet|china|valuat|autonom|robot|execut/i.test(risks),
    );
  }
  if (symbol === "MSFT") {
    console.log("msftCloud?", /cloud|ai|workplace|productivity/i.test(opps));
  }
  if (symbol === "NVDA") {
    const hdr = a.bundle.fundamentalOverview;
    console.log(
      "nvdaWikiHdr?",
      /\b(makes|manufactures|chips across|taiwan)\b/i.test(hdr),
    );
    console.log("nvdaScoreHdr?", /balance sheet|margins?|profit|expensive|rich|full price|valuation|fortress|elite/i.test(hdr));
    console.log(
      "nvdaFairValue?",
      /\bfair value|fairly valued|priced for (expected|forward) (growth|earnings)\b/i.test(
        `${hdr} ${a.bundle.summary} ${a.bundle.pillars.valuation}`,
      ),
    );
    console.log(
      "nvdaGpu?",
      /gpu|data[- ]center|accelerator/i.test(`${ident} ${opps}`),
    );
    console.log(
      "nvdaLever2?",
      /network|architecture|geforce|gaming|cuda|cluster|roadmap/i.test(opps),
    );
  }

  console.log(`======== ${symbol} second ========`);
  const b = await getNarrativeBundle(ctx);
  console.log("source", b.source, "model", b.model);
}
