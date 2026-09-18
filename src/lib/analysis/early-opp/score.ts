import {
  EARLY_OPP_STEPS,
  type EarlyOppStepId,
} from "@/lib/analysis/early-opp/steps";
import type { EarlyOppFacts } from "@/lib/analysis/early-opp/facts";
import {
  compactNumbers,
  countStatuses,
  fmpMarketCap,
  fmpNumber,
  fmpPrice,
} from "@/lib/analysis/early-opp/format";
import type {
  EarlyOppNumber,
  EarlyOppQualitativeOverlay,
  EarlyOppStatus,
  EarlyOppStepResult,
} from "@/lib/analysis/early-opp/types";

function step(
  id: EarlyOppStepId,
  status: EarlyOppStatus,
  explanation: string,
  numbers: Array<EarlyOppNumber | null | undefined>,
  source: EarlyOppStepResult["source"],
): EarlyOppStepResult {
  const def = EARLY_OPP_STEPS.find((item) => item.id === id);
  if (!def) throw new Error(`Missing step ${id}`);
  return {
    id,
    number: def.number,
    title: def.title,
    shortTitle: def.shortTitle,
    question: def.question,
    hint: def.hint,
    status,
    explanation,
    numbers: compactNumbers(numbers),
    source,
  };
}

function scoreKnowYourself(facts: EarlyOppFacts): EarlyOppStepResult {
  return step(
    "know_yourself",
    "unknown",
    `This step is yours, not ${facts.symbol}'s. Match process to temperament before size. InvestSalsa does not score your wiring and does not place orders.`,
    [],
    "education",
  );
}

function scoreSecularTrend(
  facts: EarlyOppFacts,
  ai: EarlyOppQualitativeOverlay | null,
): EarlyOppStepResult {
  const industryLine = [facts.industry, facts.sector].filter(Boolean).join(" · ");
  if (ai?.secularTheme) {
    const status = ai.secularStatus ?? "soft";
    return step(
      "secular_trend",
      status,
      ai.secularTheme,
      [],
      "hybrid",
    );
  }
  return step(
    "secular_trend",
    "unknown",
    industryLine
      ? `Financial Modeling Prep lists ${industryLine}. A secular spend wave is a theme judgment — not invented from the industry label alone.`
      : "Industry and sector did not load. A secular theme is unknown until those fields or a qualitative read are available.",
    [],
    "fmp",
  );
}

function scoreSCurve(
  facts: EarlyOppFacts,
  ai: EarlyOppQualitativeOverlay | null,
): EarlyOppStepResult {
  const numbers = [
    fmpNumber("Revenue growth", facts.revenueGrowth, "percent"),
    fmpNumber("3-year revenue path", facts.revenueCagr3y, "percent"),
    fmpNumber("Revenue (latest year)", facts.revenue, "money"),
  ];
  const aiNote = ai?.sCurveNote ? ` ${ai.sCurveNote}` : "";

  if (facts.revenueYears < 2 || facts.revenueGrowth == null) {
    return step(
      "s_curve",
      "unknown",
      `Need at least two loaded fiscal years of revenue to judge an S-curve.${aiNote}`,
      numbers,
      aiNote ? "hybrid" : "fmp",
    );
  }

  if (facts.revenueGrowth < 0) {
    return step(
      "s_curve",
      "fail",
      `Latest loaded revenue growth is negative — this does not look like an early upward S-curve.${aiNote}`,
      numbers,
      aiNote ? "hybrid" : "fmp",
    );
  }

  if (facts.revenueAccelerating === true && facts.revenueGrowth >= 0.15) {
    return step(
      "s_curve",
      "pass",
      `Revenue is growing and the latest year accelerated versus the prior year on loaded statements.${aiNote}`,
      numbers,
      aiNote ? "hybrid" : "fmp",
    );
  }

  if (facts.revenueGrowth >= 0.25) {
    return step(
      "s_curve",
      "soft",
      `Revenue growth is fast on loaded years, but acceleration is ${facts.revenueAccelerating === false ? "slowing" : "not confirmed"}. Fast is not the same as early.${aiNote}`,
      numbers,
      aiNote ? "hybrid" : "fmp",
    );
  }

  if (facts.revenueAccelerating === false && facts.revenueGrowth < 0.08) {
    return step(
      "s_curve",
      "soft",
      `Growth is modest and decelerating on loaded years — closer to a mature curve than an early one.${aiNote}`,
      numbers,
      aiNote ? "hybrid" : "fmp",
    );
  }

  return step(
    "s_curve",
    "soft",
    `Revenue is growing on loaded years, without a clean acceleration signal.${aiNote}`,
    numbers,
    aiNote ? "hybrid" : "fmp",
  );
}

function scoreFollowTheMoney(facts: EarlyOppFacts): EarlyOppStepResult {
  const numbers = [
    fmpNumber("CapEx (abs.)", facts.capexAbs, "money"),
    fmpNumber("CapEx / sales", facts.capexToSales, "percent"),
    fmpNumber("Prior CapEx / sales", facts.capexToSalesPrior, "percent"),
  ];
  if (facts.capexAbs == null) {
    return step(
      "follow_the_money",
      "unknown",
      "Capital expenditure did not load on the cash-flow statement. Spend is unknown — not guessed.",
      numbers,
      "fmp",
    );
  }
  if (facts.capexRising === true) {
    return step(
      "follow_the_money",
      "pass",
      "CapEx (absolute spend) rose versus the prior loaded year. That is a follow-the-money tell only if demand is real — pair with ROIC.",
      numbers,
      "fmp",
    );
  }
  if (facts.capexRising === false) {
    return step(
      "follow_the_money",
      "soft",
      "CapEx spend fell versus the prior loaded year. That can be discipline or a fading investment wave.",
      numbers,
      "fmp",
    );
  }
  return step(
    "follow_the_money",
    "soft",
    "CapEx loaded for one year only — direction of spend is unknown.",
    numbers,
    "fmp",
  );
}

function scoreWhoGetsCapex(
  facts: EarlyOppFacts,
  ai: EarlyOppQualitativeOverlay | null,
): EarlyOppStepResult {
  if (ai?.stackRole) {
    return step("who_gets_capex", "soft", ai.stackRole, [], "hybrid");
  }
  const industry = [facts.industry, facts.sector].filter(Boolean).join(" · ");
  return step(
    "who_gets_capex",
    "unknown",
    industry
      ? `FMP industry is ${industry}. The bill of materials (who actually receives the CapEx) is not in the statements — unknown without a stack map.`
      : "Industry did not load, and FMP statements do not name the CapEx recipients.",
    [],
    "fmp",
  );
}

function scoreWinners(
  facts: EarlyOppFacts,
  ai: EarlyOppQualitativeOverlay | null,
): EarlyOppStepResult {
  const numbers = [
    fmpNumber("Rating (0–100)", facts.ratingScore, "count"),
    fmpNumber("Growth pillar", facts.growthPillar, "count"),
    fmpNumber("ROIC", facts.roic, "percent"),
    fmpNumber("Revenue growth", facts.revenueGrowth, "percent"),
  ];
  const aiNote = ai?.winnerNote ? ` ${ai.winnerNote}` : "";

  if (facts.vehicleNonOperating) {
    return step(
      "identify_winners",
      "unknown",
      `This looks like a non-operating vehicle on the rating engine — winner quality is not scored like an operating company.${aiNote}`,
      numbers,
      aiNote ? "hybrid" : "fmp",
    );
  }
  if (facts.criticalFlags.length > 0) {
    return step(
      "identify_winners",
      "fail",
      `Critical flags on the rating engine: ${facts.criticalFlags.join(", ")}.${aiNote}`,
      numbers,
      aiNote ? "hybrid" : "fmp",
    );
  }
  if (facts.ratingScore == null && facts.revenueGrowth == null && facts.roic == null) {
    return step(
      "identify_winners",
      "unknown",
      `Quality inputs did not load.${aiNote}`,
      numbers,
      aiNote ? "hybrid" : "fmp",
    );
  }
  const strong =
    (facts.ratingLabel === "Strong" || facts.ratingLabel === "Favorable") &&
    (facts.revenueGrowth == null || facts.revenueGrowth > 0) &&
    (facts.roic == null || facts.roic >= 0.08 || (facts.fcf != null && facts.fcf > 0));
  if (strong && (facts.ratingScore ?? 0) >= 65) {
    return step(
      "identify_winners",
      "pass",
      `Rating is ${facts.ratingLabel?.toLowerCase() ?? "constructive"} and loaded growth/returns are not broken.${aiNote}`,
      numbers,
      aiNote ? "hybrid" : "fmp",
    );
  }
  if (
    facts.ratingLabel === "Weak" ||
    facts.ratingLabel === "Cautious" ||
    (facts.ratingScore != null && facts.ratingScore < 40)
  ) {
    return step(
      "identify_winners",
      "fail",
      `Rating is ${facts.ratingLabel?.toLowerCase() ?? "weak"} — this does not screen as a quality winner on loaded scores.${aiNote}`,
      numbers,
      aiNote ? "hybrid" : "fmp",
    );
  }
  return step(
    "identify_winners",
    "soft",
    `Mixed quality on loaded rating and financials${facts.ratingLabel ? ` (${facts.ratingLabel.toLowerCase()})` : ""}.${aiNote}`,
    numbers,
    aiNote ? "hybrid" : "fmp",
  );
}

function scoreFinancials(facts: EarlyOppFacts): EarlyOppStepResult {
  const numbers = [
    fmpNumber("Free cash flow", facts.fcf, "money"),
    fmpNumber("FCF growth", facts.fcfGrowth, "percent"),
    fmpNumber("Revenue growth", facts.revenueGrowth, "percent"),
    fmpNumber("Gross margin", facts.grossMargin, "percent"),
    fmpNumber("FCF margin", facts.fcfMargin, "percent"),
    fmpNumber("Rule of 40", facts.ruleOf40 != null ? facts.ruleOf40 / 100 : null, "percent"),
  ];

  if (facts.fcf == null && facts.revenueGrowth == null) {
    return step(
      "financials_fcf",
      "unknown",
      "Free cash flow and revenue growth did not load. Financials stay unknown.",
      numbers,
      "fmp",
    );
  }
  if (facts.marginsCollapsing) {
    return step(
      "financials_fcf",
      "fail",
      "Revenue is up on loaded years while gross margin compressed — the framework treats that as a miss.",
      numbers,
      "fmp",
    );
  }
  if (facts.fcf != null && facts.fcf > 0 && (facts.fcfGrowth == null || facts.fcfGrowth > 0)) {
    if (facts.revenueGrowth != null && facts.revenueGrowth > 0) {
      return step(
        "financials_fcf",
        "pass",
        "Free cash flow is positive and revenue is growing on loaded figures. FCF growth is the golden line when present.",
        numbers,
        "fmp",
      );
    }
    return step(
      "financials_fcf",
      "soft",
      "Free cash flow is positive, but revenue growth is missing or not confirmatory.",
      numbers,
      "fmp",
    );
  }
  if (facts.fcf != null && facts.fcf < 0) {
    return step(
      "financials_fcf",
      "fail",
      "Latest loaded free cash flow is negative. The golden line is not compounding.",
      numbers,
      "fmp",
    );
  }
  return step(
    "financials_fcf",
    "soft",
    "Some financials loaded, without a clean FCF-compounding picture.",
    numbers,
    "fmp",
  );
}

function scoreKillSwitches(facts: EarlyOppFacts): EarlyOppStepResult {
  const numbers = [
    fmpNumber("Total debt", facts.totalDebt, "money"),
    fmpNumber("Cash", facts.totalCash, "money"),
    fmpNumber("Debt / revenue", facts.debtToRevenue, "ratio"),
    fmpNumber("Debt / equity", facts.debtToEquity, "ratio"),
    fmpNumber("Share count change", facts.shareCountChange, "percent"),
    fmpNumber("SBC vs net income", facts.sbcVsNetIncome, "percent"),
    fmpNumber("Free cash flow", facts.fcf, "money"),
  ];
  const kills: string[] = [];

  if (facts.criticalFlags.length > 0) {
    kills.push(`Critical flags: ${facts.criticalFlags.join(", ")}.`);
  }
  if (
    facts.debtToRevenue != null &&
    facts.debtToRevenue > 2 &&
    (facts.fcf == null || facts.fcf < 0)
  ) {
    kills.push("Debt versus revenue is elevated while free cash flow is weak or missing.");
  }
  if (facts.fcf != null && facts.fcf < 0 && facts.ocf != null && facts.ocf < 0) {
    kills.push("Operating cash flow and free cash flow are both negative — cash burn.");
  }
  if (
    facts.shareCountChange != null &&
    facts.shareCountChange > 0.08 &&
    (facts.fcf == null || facts.fcf < 0)
  ) {
    kills.push("Share count rose while free cash flow is weak — dilution risk.");
  }
  if (
    facts.totalCash != null &&
    facts.totalDebt != null &&
    facts.totalCash < facts.totalDebt &&
    facts.fcf != null &&
    facts.fcf < 0
  ) {
    kills.push("Cash trails total debt while free cash flow is negative.");
  }

  const warns: string[] = [];
  if (facts.sbcVsNetIncome != null && facts.sbcVsNetIncome > 0.35) {
    warns.push("Stock-based compensation is a large share of net income.");
  }
  if (facts.debtToRevenue != null && facts.debtToRevenue > 1 && facts.fcf != null && facts.fcf > 0) {
    warns.push("Leverage is meaningful even though free cash flow is positive.");
  }

  if (kills.length > 0) {
    return step("kill_switches", "fail", kills.join(" "), numbers, "fmp");
  }
  if (
    facts.totalDebt == null &&
    facts.fcf == null &&
    facts.shareCountChange == null
  ) {
    return step(
      "kill_switches",
      "unknown",
      "Debt, cash flow, and share-count inputs did not load — kill switches are unknown, not cleared.",
      numbers,
      "fmp",
    );
  }
  if (warns.length > 0) {
    return step("kill_switches", "soft", warns.join(" "), numbers, "fmp");
  }
  return step(
    "kill_switches",
    "pass",
    "No loaded kill switch tripped (cash burn + leverage, serial dilution with losses, or critical flags). Absence of a flag is not a guarantee.",
    numbers,
    "fmp",
  );
}

function scoreCapexRoic(facts: EarlyOppFacts): EarlyOppStepResult {
  const numbers = [
    fmpNumber("ROIC", facts.roic, "percent"),
    fmpNumber("CapEx / sales", facts.capexToSales, "percent"),
    fmpNumber("CapEx (abs.)", facts.capexAbs, "money"),
  ];
  if (facts.roic == null && facts.capexAbs == null) {
    return step(
      "capex_roic",
      "unknown",
      "ROIC and CapEx did not load. Quality of spend is unknown.",
      numbers,
      "fmp",
    );
  }
  if (facts.roic != null && facts.roic >= 0.12 && facts.capexRising !== false) {
    return step(
      "capex_roic",
      "pass",
      "ROIC is healthy on the loaded figure while the company is still investing. That is the quality-of-spend tell.",
      numbers,
      "fmp",
    );
  }
  if (facts.roic != null && facts.roic < 0.05 && facts.capexToSales != null && facts.capexToSales > 0.1) {
    return step(
      "capex_roic",
      "fail",
      "CapEx is material versus sales while ROIC is weak — spend may not be earning its keep.",
      numbers,
      "fmp",
    );
  }
  if (facts.roic != null && facts.roic < 0) {
    return step(
      "capex_roic",
      "fail",
      "Loaded ROIC is negative. Reinvestment is not compounding capital on this print.",
      numbers,
      "fmp",
    );
  }
  return step(
    "capex_roic",
    "soft",
    "Spend and returns are mixed or incomplete on loaded figures.",
    numbers,
    "fmp",
  );
}

function scoreMoat(
  facts: EarlyOppFacts,
  ai: EarlyOppQualitativeOverlay | null,
): EarlyOppStepResult {
  const numbers = [
    fmpNumber("ROIC", facts.roic, "percent"),
    fmpNumber("Gross margin", facts.grossMargin, "percent"),
    fmpNumber("Operating margin", facts.operatingMargin, "percent"),
  ];
  if (ai?.moatNote) {
    const status: EarlyOppStatus =
      ai.moatCopyTest === "hard_to_copy"
        ? "pass"
        : ai.moatCopyTest === "copyable"
          ? "fail"
          : "soft";
    return step("moat", status, ai.moatNote, numbers, "hybrid");
  }
  if (facts.roic != null && facts.roic >= 0.15 && facts.grossMargin != null && facts.grossMargin >= 0.4) {
    return step(
      "moat",
      "soft",
      "High loaded ROIC and gross margin are a proxy, not a three-year copy test. A well-funded rival might still copy the product.",
      numbers,
      "fmp",
    );
  }
  if (facts.roic == null && facts.grossMargin == null) {
    return step(
      "moat",
      "unknown",
      "Returns and margins did not load, and there is no qualitative copy-test read.",
      numbers,
      "fmp",
    );
  }
  return step(
    "moat",
    "unknown",
    "Loaded returns are not strong enough to stand in for a moat, and the three-year copy test needs a qualitative read.",
    numbers,
    "fmp",
  );
}

function scoreOwnership(facts: EarlyOppFacts): EarlyOppStepResult {
  if (facts.insiderTone === "none") {
    return step(
      "ownership",
      "unknown",
      "No insider-trade summary loaded from Financial Modeling Prep. 13F / smart-money names are not invented.",
      [],
      "fmp",
    );
  }
  if (facts.insiderTone === "buy") {
    return step(
      "ownership",
      "pass",
      `Insider tape leans toward buying. ${facts.insiderSummaries[0] ?? ""}`.trim(),
      [],
      "fmp",
    );
  }
  if (facts.insiderTone === "sell") {
    return step(
      "ownership",
      "fail",
      `Insider tape leans toward selling. ${facts.insiderSummaries[0] ?? ""}`.trim(),
      [],
      "fmp",
    );
  }
  return step(
    "ownership",
    "soft",
    `Insider tape is mixed. ${facts.insiderSummaries[0] ?? ""}`.trim(),
    [],
    "fmp",
  );
}

function scoreAnalystTargets(facts: EarlyOppFacts): EarlyOppStepResult {
  const numbers = [
    fmpPrice("Price", facts.price),
    fmpPrice("Consensus target", facts.targetConsensus),
    fmpPrice("High target", facts.targetHigh),
    fmpPrice("Low target", facts.targetLow),
    fmpNumber("Implied vs price", facts.targetUpsidePct, "percent"),
    fmpNumber("Buy / strong buy", facts.streetBuyCount, "count"),
    fmpNumber("Hold", facts.streetHoldCount, "count"),
    fmpNumber("Sell / strong sell", facts.streetSellCount, "count"),
  ];
  if (facts.targetConsensus == null && facts.streetConsensus == null) {
    return step(
      "analyst_targets",
      "unknown",
      "No street target or consensus loaded. Targets are sentiment only — and here they are missing, not guessed.",
      numbers,
      "fmp",
    );
  }
  const crowded =
    facts.streetBuyCount != null &&
    facts.streetHoldCount != null &&
    facts.streetBuyCount >= facts.streetHoldCount * 2 &&
    facts.streetBuyCount >= 8;
  if (crowded) {
    return step(
      "analyst_targets",
      "soft",
      `Street leans bullish${facts.streetConsensus ? ` (${facts.streetConsensus})` : ""}. Treat the target as crowded sentiment, not a buy ticket.`,
      numbers,
      "fmp",
    );
  }
  return step(
    "analyst_targets",
    "soft",
    `Street target and ratings are sentiment only${facts.streetConsensus ? ` — consensus ${facts.streetConsensus}` : ""}. Wall Street often misses S-curves; a high target is not a thesis.`,
    numbers,
    "fmp",
  );
}

function scorePeg(facts: EarlyOppFacts): EarlyOppStepResult {
  const numbers = [
    fmpNumber("PEG", facts.pegRatio, "ratio"),
    fmpNumber("Trailing P/E", facts.trailingPe, "multiple"),
    fmpNumber("Forward P/E", facts.forwardPe, "multiple"),
  ];
  if (facts.pegRatio == null) {
    return step(
      "peg",
      "unknown",
      "PEG did not load from Financial Modeling Prep. It is not computed from a guessed growth rate.",
      numbers,
      "fmp",
    );
  }
  if (facts.pegRatio < 1) {
    return step(
      "peg",
      "pass",
      "Loaded PEG is under 1 — cheap relative to the growth rate FMP used, if that growth is real.",
      numbers,
      "fmp",
    );
  }
  if (facts.pegRatio <= 1.5) {
    return step(
      "peg",
      "soft",
      "Loaded PEG is near 1–1.5 — not a bargain and not extreme on this print.",
      numbers,
      "fmp",
    );
  }
  return step(
    "peg",
    "fail",
    "Loaded PEG is above 1.5 — the multiple is expensive versus the growth rate on this print.",
    numbers,
    "fmp",
  );
}

function scoreChartTiming(
  facts: EarlyOppFacts,
  financials: EarlyOppStatus,
  kills: EarlyOppStatus,
): EarlyOppStepResult {
  const numbers = [];
  const zone = facts.techZone;
  const stretched =
    facts.techZoneId === "red" || facts.techZoneId === "orange";
  const constructive =
    facts.techZoneId === "green" || facts.techZoneId === "dark_green";

  if (zone) {
    numbers.push({
      label: "Price zone",
      display: zone,
      value: null,
      kind: "text" as const,
      source: "fmp" as const,
    });
  }
  if (facts.techHeat) {
    numbers.push({
      label: "Daily heat",
      display: facts.techHeat,
      value: null,
      kind: "text" as const,
      source: "fmp" as const,
    });
  }

  if (!zone) {
    return step(
      "chart_timing",
      "unknown",
      "Price zone did not load. Timing stays unknown — fundamentals still come first.",
      numbers,
      "fmp",
    );
  }
  if ((financials === "fail" || kills === "fail") && stretched === false) {
    return step(
      "chart_timing",
      "fail",
      `Fundamentals failed a kill or FCF check. ${zone} is not a reason to buy a broken thesis because it looks cheap.`,
      numbers,
      "fmp",
    );
  }
  if (constructive && financials !== "fail" && kills !== "fail") {
    return step(
      "chart_timing",
      "pass",
      `Price zone is ${zone}. Fundamentals are not failed on loaded checks — timing is the more constructive part of the setup.`,
      numbers,
      "fmp",
    );
  }
  if (stretched) {
    return step(
      "chart_timing",
      "soft",
      `Price zone is ${zone} — stretched. Even a good thesis can wait for a less crowded print.`,
      numbers,
      "fmp",
    );
  }
  return step(
    "chart_timing",
    "soft",
    `Price zone is ${zone}. Use it as timing after the fundamental steps, not instead of them.`,
    numbers,
    "fmp",
  );
}

function scoreWhyMoving(
  facts: EarlyOppFacts,
  ai: EarlyOppQualitativeOverlay | null,
): EarlyOppStepResult {
  const numbers = [
    fmpNumber("Day change", facts.changePercent, "percent"),
    fmpNumber("Volume", facts.volume, "count"),
    fmpNumber("Average volume", facts.averageVolume, "count"),
    fmpMarketCap("Market cap", facts.marketCap),
  ];
  const volumeSpike =
    facts.volume != null &&
    facts.averageVolume != null &&
    facts.averageVolume > 0 &&
    facts.volume > facts.averageVolume * 1.5;

  if (ai?.whyMoving) {
    return step("why_moving", "soft", ai.whyMoving, numbers, "hybrid");
  }
  if (facts.changePercent == null) {
    return step(
      "why_moving",
      "unknown",
      "Day change did not load, so the tape reason is unknown. No catalyst is invented.",
      numbers,
      "fmp",
    );
  }
  const movePct =
    Math.abs(facts.changePercent) <= 1.5
      ? facts.changePercent * 100
      : facts.changePercent;
  const move = `${movePct >= 0 ? "+" : ""}${movePct.toFixed(1)}%`;
  return step(
    "why_moving",
    "unknown",
    `${facts.symbol} last print moved ${move}${volumeSpike ? " on above-average volume" : ""}. The why (macro, flow, news) is not in the quote — unknown without a qualitative read.`,
    numbers,
    "fmp",
  );
}

function scoreExitPlan(): EarlyOppStepResult {
  return step(
    "exit_plan",
    "unknown",
    "Write the exit, position size, and thesis kill switch before you buy. The framework suggests a small satellite sleeve versus a core book — InvestSalsa does not size this for you and does not place an order.",
    [],
    "education",
  );
}

export function scoreEarlyOppSteps(
  facts: EarlyOppFacts,
  ai: EarlyOppQualitativeOverlay | null,
): EarlyOppStepResult[] {
  const financials = scoreFinancials(facts);
  const kills = scoreKillSwitches(facts);
  const steps: EarlyOppStepResult[] = [
    scoreKnowYourself(facts),
    scoreSecularTrend(facts, ai),
    scoreSCurve(facts, ai),
    scoreFollowTheMoney(facts),
    scoreWhoGetsCapex(facts, ai),
    scoreWinners(facts, ai),
    financials,
    kills,
    scoreCapexRoic(facts),
    scoreMoat(facts, ai),
    scoreOwnership(facts),
    scoreAnalystTargets(facts),
    scorePeg(facts),
    scoreChartTiming(facts, financials.status, kills.status),
    scoreWhyMoving(facts, ai),
    scoreExitPlan(),
  ];
  return steps.sort((a, b) => a.number - b.number);
}

export function earlyOppCountsFromSteps(steps: EarlyOppStepResult[]) {
  return countStatuses(steps.map((step) => step.status));
}
