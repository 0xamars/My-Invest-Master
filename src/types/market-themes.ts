export type MarketSentiment = "positive" | "neutral" | "rising";

export type MarketStockQuality = "strong" | "balanced" | "watch";

export interface MarketThemeStock {
  ticker: string;
  name: string;
  reason: string;
  /** Short highlights like "Rev +28% YoY · PEG ~1.1" */
  metrics: string;
  quality: MarketStockQuality;
  /** Optional qualitative note on valuation / growth / financials */
  valuationNote?: string;
}

export interface MarketTheme {
  id: string;
  name: string;
  description: string;
  sentiment: MarketSentiment;
  /** Why this theme is popular now (AI / social synthesis) */
  popularityReason: string;
  stocks: MarketThemeStock[];
}

export interface MarketThemesPayload {
  generatedAt: string;
  source: "ai" | "cache" | "fallback";
  provider?: string;
  themes: MarketTheme[];
  disclaimer: string;
}

export interface CustomThemePayload {
  generatedAt: string;
  source: "ai" | "cache" | "fallback";
  provider?: string;
  theme: MarketTheme;
  disclaimer: string;
}

export const MARKET_INSIGHTS_DISCLAIMER =
  "AI-generated insights for educational purposes only. Not financial advice.";

/** Dropdown catalog — curated theme IDs the explorer can request. */
export const CUSTOM_THEME_CATALOG: Array<{
  id: string;
  name: string;
  blurb: string;
}> = [
  { id: "ai-infrastructure", name: "AI Infrastructure", blurb: "Chips, cloud, and data-center enablers" },
  { id: "semiconductors", name: "Semiconductors", blurb: "Designers, foundries, and equipment" },
  { id: "cybersecurity", name: "Cybersecurity", blurb: "Endpoint, cloud, and identity security" },
  { id: "nuclear-energy", name: "Nuclear Energy", blurb: "Utilities, uranium, and nuclear tech" },
  { id: "clean-energy", name: "Clean Energy", blurb: "Solar, wind, storage, and grid" },
  { id: "obesity-glp1", name: "Obesity / GLP-1", blurb: "Metabolic drugs and related care" },
  { id: "biotech", name: "Biotech", blurb: "Therapeutics and platform biotech" },
  { id: "fintech", name: "Fintech", blurb: "Payments, banking platforms, and software" },
  { id: "defense", name: "Defense", blurb: "Aerospace, defense primes, and sensors" },
  { id: "robotics", name: "Robotics & Automation", blurb: "Industrial robots and factory software" },
  { id: "ev-mobility", name: "EV & Mobility", blurb: "EVs, charging, and auto tech" },
  { id: "cloud-saas", name: "Cloud & SaaS", blurb: "Infrastructure and vertical software" },
  { id: "data-centers", name: "Data Centers", blurb: "REITs, power, and cooling" },
  { id: "copper-materials", name: "Copper & Materials", blurb: "Electrification materials" },
  { id: "space", name: "Space & Satellites", blurb: "Launch, satellites, and ground systems" },
];
