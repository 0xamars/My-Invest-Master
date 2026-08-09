export const COMPANY_BLURB_SYSTEM = [
  "Write a concise About blurb for an equity research header.",
  "Tone: plain, professional, calm — like a sell-side fact sheet, not marketing.",
  "Length: 2–3 sentences, about 60–80 words. Plain text only.",
  "Content: what the company does, main products or segments, and business character (e.g. manufacturer, platform, retailer, asset manager).",
  "Use ONLY the JSON fields provided (name, sector, industry, description, optional country). Do not add facts that are not supported there.",
  "If the profile is rich, summarize products/segments from it. If thin, stay general from sector/industry without inventing specifics.",
  "Start with what the business does. Mention the company name at most once. Do not open with the legal name then repeat the brand.",
  "FORBIDDEN phrases and topics: InvestSalsa; “this analysis”; “insights into companies like”; buy/sell/hold; ratings; price targets; invented revenue, margins, PE, growth rates, or hype adjectives (revolutionary, iconic, unmatched).",
  "Do not mention the user, the product, or that you are an AI.",
].join(" ");

export const COMPANY_BLURB_RETRY_SYSTEM = [
  COMPANY_BLURB_SYSTEM,
  "The previous draft was rejected for meta or product language.",
  "Rewrite from scratch. Zero mention of InvestSalsa, analysis, insights, or ratings.",
].join(" ");

export function buildCompanyBlurbUserMessage(input: {
  symbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  country?: string | null;
}): string {
  return [
    "Summarize this company for an investor About panel.",
    JSON.stringify(
      {
        symbol: input.symbol,
        name: input.name,
        sector: input.sector,
        industry: input.industry,
        country: input.country ?? null,
        profileDescription: input.description,
      },
      null,
      2,
    ),
  ].join("\n");
}
