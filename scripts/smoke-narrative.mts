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
    forecast: pkg.forecast,
    price: pkg.quote?.price ?? null,
  });

  console.log(`\n======== ${symbol} first ========`);
  const a = await getNarrativeBundle(ctx);
  console.log("source", a.source, "model", a.model);
  console.log("industry", ctx.industry, "path", ctx.path);
  console.log("sbcBurden", ctx.sbcBurden, "sbcToRev", pkg.fundamentals?.sbcToRevenue);
  console.log("valBasis", ctx.valuationLanguage.basis, "fwdPE", pkg.fundamentals?.forwardPE);
  console.log(
    "outlookFacts",
    JSON.stringify(ctx.packageFacts?.slice(0, 8) ?? []),
  );
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
    a.bundle.futureOutlook.opportunities
      .map((x) => `- ${x.title}: ${x.body}`)
      .join("\n"),
  );
  console.log(
    "RISKS:\n",
    a.bundle.futureOutlook.risks
      .map((x) => `- ${x.title}: ${x.body}`)
      .join("\n"),
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
  const ident = `${a.bundle.summary} ${a.bundle.futureOutlook.opportunities.map((x) => `${x.title} ${x.body}`).join(" ")}`;
  const opps = a.bundle.futureOutlook.opportunities
    .map((x) => `${x.title} ${x.body}`)
    .join(" ");
  const risks = a.bundle.futureOutlook.risks
    .map((x) => `${x.title} ${x.body}`)
    .join(" ");
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
  const items = [
    ...a.bundle.futureOutlook.opportunities,
    ...a.bundle.futureOutlook.risks,
  ];
  const longBodies = items.filter(
    (x) =>
      x.body.split(/(?<=[.!?])\s+/).filter((s) => s.replace(/[.!?]/g, "").trim().length > 12)
        .length >= 3,
  ).length;
  console.log("outlookWordy?", longBodies >= 4, "longBodies", longBodies);
  console.log(
    "oppCount",
    a.bundle.futureOutlook.opportunities.length,
    "riskCount",
    a.bundle.futureOutlook.risks.length,
  );
  console.log(
    "paddedQuota?",
    a.bundle.futureOutlook.opportunities.length >= 6 &&
      a.bundle.futureOutlook.risks.length >= 6,
  );

  if (symbol === "FLNC") {
    console.log(
      "flncTeslaLeak?",
      /fsd|robotaxi|cybercab|optimus|megapack/i.test(`${opps} ${risks}`),
    );
    console.log(
      "flncCompany?",
      /software|control|backlog|commission|margin|integrated|working capital|balance sheet|capital/i.test(
        `${opps} ${risks}`,
      ),
    );
    console.log(
      "flncGenericStorage?",
      /\b(storage demand|renewables need|policy delays hurt the industry|energy transition drives)\b/i.test(
        `${opps} ${risks}`,
      ) &&
        !/backlog|commission|software|control|margin|working capital|capital/i.test(
          `${opps} ${risks}`,
        ),
    );
  }
  if (symbol === "ONDS") {
    console.log("ondasTeslaLeak?", /fsd|robotaxi|cybercab|optimus|megapack/i.test(`${opps} ${risks}`));
    console.log("ondasThemes?", /radio|drone|wireless|order|burn|dilut|spectrum|standard/i.test(`${opps} ${risks}`));
  }
  if (symbol === "MFC") {
    console.log("mfcTeslaLeak?", /fsd|robotaxi|cybercab|optimus/i.test(`${opps} ${risks}`));
    console.log("mfcInsurer?", /asia|canada|wealth|premium|investment|annuit|fee|spread/i.test(`${opps} ${risks}`));
    console.log(
      "mfcNestedRegion?",
      /hong kong|japan|canada|john hancock|united states|\bu\.s\.\b/i.test(`${opps} ${risks}`),
    );
    console.log(
      "mfcProduct?",
      /wealth|protection|fee|annuit|workplace|investment book/i.test(`${opps} ${risks}`),
    );
    console.log(
      "mfcAsiaOnly?",
      /\basia\b/i.test(`${opps} ${risks}`) &&
        !/hong kong|japan|china|singapore/i.test(`${opps} ${risks}`),
    );
  }
  if (symbol === "MRVL") {
    console.log("mrvlCudaLeak?", /cuda|geforce|fsd|robotaxi/i.test(`${opps} ${risks}`));
    console.log("mrvlCustom?", /custom|asic|optics|optical|ethernet|cloud|concentrat/i.test(`${opps} ${risks}`));
    console.log(
      "mrvlBuyerSpec?",
      /amazon|aws|google|microsoft|meta|oracle|handful|majority of custom|few large cloud/i.test(
        `${opps} ${risks}`,
      ),
    );
    console.log(
      "mrvlBareHyperscalers?",
      /\bhyperscalers?\b/i.test(`${opps} ${risks}`) &&
        !/amazon|aws|google|microsoft|meta|handful|majority of custom|few large cloud/i.test(
          `${opps} ${risks}`,
        ),
    );
  }
  if (symbol === "MSTR") {
    console.log("mstrTeslaLeak?", /fsd|robotaxi|cybercab|optimus/i.test(`${opps} ${risks}`));
    console.log("mstrTreasury?", /bitcoin|btc|nav|treasury|holdings|dilut|premium/i.test(`${opps} ${risks}`));
    const scaleN = items.filter((x) => {
      const t = `${x.title} ${x.body}`.toLowerCase();
      const holdings =
        /bitcoin|btc|holdings|treasury/.test(t) &&
        /largest|size of|stack|billion|million|\d[\d,]*\s*btc/.test(t);
      const funding = /atm|at-the-market|convertible|dilut/.test(t);
      const prem = /premium|discount|\bnav\b/.test(t);
      const debt = /\bdebt\b|leverage/.test(t);
      return holdings || funding || prem || debt;
    }).length;
    console.log("mstrScaleBullets", scaleN);
    console.log(
      "mstrHoldingsClass?",
      /largest|size of|stack|\d[\d,]*\s*btc|billion|million/i.test(`${opps} ${risks}`),
    );
    console.log("mstrAtm?", /atm|at-the-market|convertible/i.test(`${opps} ${risks}`));
    console.log("mstrPremOrDebt?", /premium|discount|\bnav\b|\bdebt\b|leverage/i.test(`${opps} ${risks}`));
    console.log("mstrHasScale?", /\d|billion|million|btc|holdings/i.test(`${opps} ${risks}`));
  }
  if (symbol === "TSLA") {
    console.log(
      "titled?",
      a.bundle.futureOutlook.opportunities.every((o) => o.title.length >= 3),
    );
    console.log("tslaEnergy?", /energy|storage/i.test(opps));
    console.log("tslaFsd?", /fsd|full self[- ]driv|software (annuity|attach)/i.test(opps));
    console.log("tslaAutonomy?", /autonom|robotaxi|cybercab|self-driv/i.test(opps));
    console.log("tslaHumanoid?", /humanoid|optimus/i.test(opps));
    console.log(
      "tslaRisk?",
      /capex|cash|valuat|multiple|rival|compet|dilut|share count|autonom/i.test(risks),
    );
    console.log(
      "tslaStreetTargetInOutlook?",
      /price target|average target|\$\d{2,}/i.test(`${opps} ${risks}`),
    );
    console.log(
      "tslaAdvice?",
      /\b(buy now|sell now|good time to buy)\b/i.test(`${opps} ${risks}`),
    );
    const distinctive =
      /fsd|full self[- ]driv|robotaxi|cybercab|optimus|energy storage|unsupervised/i.test(
        opps,
      );
    const unknownPkg = (
      `${opps} ${risks}`.match(/unknown in this package|not in this package/gi) ?? []
    ).length;
    const filler =
      /growth opportunities|competitive pressures|\bexecution risk\b|priced for perfection/i.test(
        `${opps} ${risks}`,
      );
    console.log("tslaDistinctive?", distinctive);
    console.log("tslaUnknownPackageRefrain?", unknownPkg);
    const multiFig = [
      ...a.bundle.futureOutlook.opportunities,
      ...a.bundle.futureOutlook.risks,
    ].filter((x) => (x.body.match(/\d/g) ?? []).length >= 2).length;
    console.log("tslaMultiFigureBullets?", multiFig);
    console.log("tslaFiller?", filler);
    console.log(
      "tslaScale?",
      /fleet|attach|subscription|fcf|free cash|capex|latest[- ]quarter/i.test(`${opps} ${risks}`),
    );
  }
  if (symbol === "MSFT") {
    console.log("msftCloud?", /cloud|ai|workplace|productivity/i.test(opps));
  }
  const headerSummary = [
    a.bundle.fundamentalOverview,
    a.bundle.summary,
    ...(a.bundle.summaryBullets ?? []),
  ].join(" ");
  console.log("copyLanguage", JSON.stringify(ctx.copyLanguage));
  console.log("hdr", a.bundle.fundamentalOverview);
  console.log("thickThinHeader?", /\b(thick|thin)\b/i.test(headerSummary));
  if (ctx.copyLanguage.earnings === "unprofitable") {
    console.log(
      "namesLosses?",
      /unprofitable|operating losses?|not yet profitable/i.test(headerSummary),
    );
    console.log(
      "softenedLosses?",
      /margin pressure/i.test(headerSummary) &&
        !/unprofitable|operating losses?|not yet profitable/i.test(headerSummary),
    );
  }
  if (ctx.copyLanguage.margins === "strong") {
    console.log(
      "strongMarginLang?",
      /strong margins|high margins|cash conversion|fortress|net[- ]cash/i.test(
        headerSummary,
      ),
    );
  }
  if (ctx.copyLanguage.growth === "elite") {
    console.log(
      "eliteGrowthLang?",
      /very fast|elite growth|hyper-growth|explosive/i.test(headerSummary),
    );
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
