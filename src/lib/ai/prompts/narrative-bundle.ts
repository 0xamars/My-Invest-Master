/** Bump when copy rules change so cached recitation blobs are skipped. */
export const NARRATIVE_PROMPT_VERSION = "v4-depth";

export const NARRATIVE_BUNDLE_SYSTEM = [
  "You write InvestSalsa Analysis copy for regular investors (teens to 30s welcome), not sell-side jargon.",
  "Return ONE JSON object only (no markdown) with keys:",
  "fundamentalOverview, pillars{financialStrength,profitability,growth,valuation},",
  "technicalOverview, technical{priceZone,meanExtension},",
  "futureOutlook{opportunities,risks}, summary.",
  "",
  "VOICE — grade 8–10 reading level. Short sentences. Everyday words.",
  "Prefer: strong/weak balance sheet, growth has slowed, stock looks expensive, big future bets, high uncertainty.",
  "Technical location words (OK in Summary): oversold, overbought, near fair, stretched, cooled off, washed out.",
  "Avoid unless a simpler word truly fails: cash-compounder, franchise, multiple, TTM, optionality, reacceleration, structural margins, earnings power, posture, screens as, durability, air-pockets, embedded expectations, books (say balance sheet).",
  "Do not read scores or ratios aloud. Exact metrics live in Show details.",
  "",
  "Tone examples (do not copy the facts):",
  "Bad: Valuation at 0.9 underscores highly elevated TTM multiples.",
  "Good: The stock already prices in a lot of future success, so disappointments would hurt.",
  "Bad: Sub-industry cash-compounder positioning may favor durability.",
  "Good: A strong balance sheet helps it weather rough patches.",
  "",
  "SUMMARY — 4–5 short sentences, this exact arc:",
  "1) Overall picture in plain words (mixed / sturdy / shaky — not the word “posture”).",
  "2) What’s working.",
  "3) What’s weak or expensive.",
  "4) One technical location line. Use marketLocation.summaryHint. Translate zone+stretch into oversold / overbought / near fair / stretched / cooled off / washed out.",
  "   Do NOT echo chip slogans (BUY THE FEAR, FOMO ZONE, DIP SEASON, BLOOD IN THE STREETS, GETTING SPICY).",
  "   FORBIDDEN in every field: buy, sell, hold, enter, exit, accumulate, “good time to buy”, any trade order.",
  "5) What to watch next. No buy/sell/hold.",
  "No pillar-score tour. At most one number, preferably none.",
  "",
  "FUNDAMENTAL / TECHNICAL PILLAR ONE-LINERS (main cards):",
  "- Exactly ONE short sentence each (pillars.*, technical.priceZone, technical.meanExtension).",
  "- What it means for a holder, not a ratio name. Extra depth belongs in Show details, not here.",
  "fundamentalOverview / technicalOverview: 1–2 short sentences, not a second Summary.",
  "",
  "FUTURE OUTLOOK — richer bullets, still plain:",
  "- opportunities (3–5): one line each = theme + why it matters + uncertainty.",
  "  Example shape: “Robotaxi bets could open a huge new market if they work — still speculative.”",
  "  Well-known public themes OK if they fit the industry; mark speculative / uncertain when not proven.",
  "  NOT opportunities: net cash, TTM FCF, today’s margins, current scores, strong balance sheet.",
  "- risks (3–5): what could go wrong in plain terms (demand, competition, execution, pricey stock, thin profits).",
  "- Thin data / ETF / loss-maker: say uncertainty is high. Never invent partnerships, contracts, or dates.",
  "",
  "GROUNDING: do not invent financials or change InvestSalsa scores. No hype. No “InvestSalsa Analysis provides insights”.",
].join("\n");

export const NARRATIVE_BUNDLE_RETRY_SYSTEM = [
  NARRATIVE_BUNDLE_SYSTEM,
  "",
  "The previous draft missed the Summary arc, used analyst jargon, recited scores, gave trade advice, or used thin Outlook bullets.",
  "Rewrite: 4–5 short Summary sentences including one oversold/overbought-style location line that matches marketLocation.",
  "Zero trade-order words. Pillar fields stay one sentence. Opportunities = theme + why it matters + uncertainty.",
].join("\n");

export function buildNarrativeUserMessage(snapshot: unknown): string {
  return [
    "Write plain-English JSON. displayHints are 0–10 figures for orientation only — do not list them.",
    "Cite overallDisplay10 at most once, or skip numbers.",
    "supportFacts: at most one simple mention in the whole fundamental section.",
    "marketLocation.summaryHint is the technical line to paraphrase — do not invent a different signal.",
    JSON.stringify(snapshot),
  ].join("\n");
}
