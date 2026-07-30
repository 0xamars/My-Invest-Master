import type { MarketTheme, MarketThemesPayload } from "@/types/market-themes";
import { MARKET_INSIGHTS_DISCLAIMER } from "@/types/market-themes";

/**
 * High-quality fallback themes used when AI is unavailable.
 * Structured so external sentiment/market feeds can replace this later.
 */
export const FALLBACK_POPULAR_THEMES: MarketTheme[] = [
  {
    id: "ai-infrastructure",
    name: "AI Infrastructure",
    description:
      "Compute, networking, and power that underpin large-scale model training and inference.",
    sentiment: "rising",
    popularityReason:
      "Enterprise AI spend and data-center buildouts remain the dominant market narrative.",
    stocks: [
      {
        ticker: "NVDA",
        name: "NVIDIA",
        reason: "Leading GPU platform for AI training and inference.",
        metrics: "Strong margins · High ROIC · Growth leadership",
        quality: "strong",
        valuationNote: "Premium multiple; growth still supports narrative",
      },
      {
        ticker: "AVGO",
        name: "Broadcom",
        reason: "Custom AI ASICs and networking silicon for hyperscalers.",
        metrics: "High FCF · Solid ROE · Diversified demand",
        quality: "strong",
        valuationNote: "Fair-to-full on near-term earnings power",
      },
      {
        ticker: "AMD",
        name: "Advanced Micro Devices",
        reason: "Competitive GPUs and CPUs expanding AI share.",
        metrics: "Improving mix · Revenue acceleration",
        quality: "balanced",
        valuationNote: "More reasonable vs peers on growth outlook",
      },
      {
        ticker: "MSFT",
        name: "Microsoft",
        reason: "Azure AI cloud and Copilot distribute AI at scale.",
        metrics: "Cloud growth · Fortress balance sheet",
        quality: "strong",
        valuationNote: "Quality premium; durable cash flows",
      },
      {
        ticker: "ANET",
        name: "Arista Networks",
        reason: "High-speed Ethernet switching for AI clusters.",
        metrics: "High margins · Strong ROIC",
        quality: "strong",
        valuationNote: "Elevated multiple; tied to AI capex cycle",
      },
    ],
  },
  {
    id: "nuclear-energy",
    name: "Nuclear Energy",
    description:
      "Baseload clean power and fuel-cycle names benefiting from AI and grid demand.",
    sentiment: "rising",
    popularityReason:
      "Hyperscaler power needs and policy support lifted nuclear and uranium interest.",
    stocks: [
      {
        ticker: "CEG",
        name: "Constellation Energy",
        reason: "Largest U.S. nuclear fleet with AI power offtake optionality.",
        metrics: "Stable cash flows · Nuclear leverage",
        quality: "strong",
        valuationNote: "Re-rated; still supported by contracted demand",
      },
      {
        ticker: "VST",
        name: "Vistra",
        reason: "Integrated generation with nuclear and retail exposure.",
        metrics: "Earnings growth · FCF focus",
        quality: "balanced",
        valuationNote: "More reasonable after run-up on cash flow",
      },
      {
        ticker: "CCJ",
        name: "Cameco",
        reason: "Leading uranium producer for the nuclear fuel cycle.",
        metrics: "Tight supply · Long-term contracts",
        quality: "balanced",
        valuationNote: "Cyclical; fair if uranium prices hold",
      },
      {
        ticker: "BWXT",
        name: "BWX Technologies",
        reason: "Nuclear components and services with defense ties.",
        metrics: "Healthy backlog · Solid margins",
        quality: "strong",
        valuationNote: "Quality name; moderate premium",
      },
      {
        ticker: "LEU",
        name: "Centrus Energy",
        reason: "Enrichment capability aligned with domestic fuel security.",
        metrics: "Policy tailwinds · Niche capacity",
        quality: "watch",
        valuationNote: "Higher volatility; growth-option profile",
      },
    ],
  },
  {
    id: "obesity-glp1",
    name: "Obesity / GLP-1",
    description:
      "Metabolic therapies and adjacent platforms reshaping obesity and diabetes care.",
    sentiment: "positive",
    popularityReason:
      "GLP-1 adoption and pipeline updates keep healthcare social and news flow elevated.",
    stocks: [
      {
        ticker: "LLY",
        name: "Eli Lilly",
        reason: "Category leader in GLP-1 and metabolic franchise expansion.",
        metrics: "High growth · Strong ROE · Robust pipeline",
        quality: "strong",
        valuationNote: "Rich multiple; earnings growth still catching up",
      },
      {
        ticker: "NVO",
        name: "Novo Nordisk",
        reason: "Global GLP-1 franchise with manufacturing scale-up.",
        metrics: "High margins · Durable demand",
        quality: "strong",
        valuationNote: "Premium; watch capacity and competition",
      },
      {
        ticker: "AMGN",
        name: "Amgen",
        reason: "Diversified biopharma with metabolic pipeline optionality.",
        metrics: "Solid FCF · Reasonable leverage",
        quality: "balanced",
        valuationNote: "More fairly valued vs pure-play peers",
      },
      {
        ticker: "VKTX",
        name: "Viking Therapeutics",
        reason: "Oral/injectable metabolic candidates in development.",
        metrics: "Clinical catalysts · High growth optionality",
        quality: "watch",
        valuationNote: "Speculative; not traditional value",
      },
      {
        ticker: "PODD",
        name: "Insulet",
        reason: "Insulin delivery devices benefiting from diabetes care trends.",
        metrics: "Revenue growth · Expanding adoption",
        quality: "balanced",
        valuationNote: "Growth stock; valuation tied to uptake",
      },
    ],
  },
  {
    id: "cybersecurity",
    name: "Cybersecurity",
    description:
      "Platforms protecting cloud, identity, and endpoints as attack surfaces expand.",
    sentiment: "positive",
    popularityReason:
      "Ongoing breach headlines and AI-driven threat narratives sustain investor attention.",
    stocks: [
      {
        ticker: "CRWD",
        name: "CrowdStrike",
        reason: "Endpoint and cloud security platform with AI features.",
        metrics: "High growth · Strong retention",
        quality: "strong",
        valuationNote: "Premium SaaS multiple; quality franchise",
      },
      {
        ticker: "PANW",
        name: "Palo Alto Networks",
        reason: "Broad security platform spanning network to cloud.",
        metrics: "Scale · Improving profitability",
        quality: "strong",
        valuationNote: "Fairer after multiple compression vs peak",
      },
      {
        ticker: "FTNT",
        name: "Fortinet",
        reason: "Cost-efficient security appliances and subscriptions.",
        metrics: "Healthy margins · Cash generation",
        quality: "balanced",
        valuationNote: "Often more reasonably valued in the group",
      },
      {
        ticker: "ZS",
        name: "Zscaler",
        reason: "Zero-trust cloud security aligned with hybrid work.",
        metrics: "High growth · Expanding platform",
        quality: "balanced",
        valuationNote: "Growth-priced; watch rule of 40",
      },
      {
        ticker: "RPD",
        name: "Rapid7",
        reason: "Vulnerability management and SecOps tooling.",
        metrics: "Improving mix · Mid-market exposure",
        quality: "watch",
        valuationNote: "More modest valuation vs mega-platforms",
      },
    ],
  },
  {
    id: "semiconductors",
    name: "Semiconductors",
    description:
      "Design, manufacturing, and equipment across AI, automotive, and industrial chips.",
    sentiment: "neutral",
    popularityReason:
      "Cycle recovery debates mix with AI upside — social interest stays high but selective.",
    stocks: [
      {
        ticker: "TSM",
        name: "Taiwan Semiconductor",
        reason: "Leading foundry for advanced AI and mobile nodes.",
        metrics: "High ROE · Capacity leadership",
        quality: "strong",
        valuationNote: "Often fair relative to growth and moat",
      },
      {
        ticker: "ASML",
        name: "ASML",
        reason: "EUV monopoly enabling advanced chip manufacturing.",
        metrics: "Exceptional margins · Backlog visibility",
        quality: "strong",
        valuationNote: "Quality premium; long-duration growth",
      },
      {
        ticker: "KLAC",
        name: "KLA",
        reason: "Process control equipment critical to yield at advanced nodes.",
        metrics: "High FCF · Strong ROIC",
        quality: "strong",
        valuationNote: "Typically fairly valued vs peers on cash returns",
      },
      {
        ticker: "AVGO",
        name: "Broadcom",
        reason: "Custom silicon and networking across AI and enterprise.",
        metrics: "Scale · High cash conversion",
        quality: "strong",
        valuationNote: "Full but supported by earnings power",
      },
      {
        ticker: "MU",
        name: "Micron",
        reason: "Memory leverage to AI servers and HBM demand.",
        metrics: "Cyclical rebound · Capex discipline",
        quality: "balanced",
        valuationNote: "More attractive mid-cycle vs peak multiples",
      },
    ],
  },
];

export function buildFallbackPopularPayload(): MarketThemesPayload {
  return {
    generatedAt: new Date().toISOString(),
    source: "fallback",
    themes: FALLBACK_POPULAR_THEMES,
    disclaimer: MARKET_INSIGHTS_DISCLAIMER,
  };
}

export function buildFallbackCustomTheme(themeId: string, themeName: string): MarketTheme {
  const existing = FALLBACK_POPULAR_THEMES.find((theme) => theme.id === themeId);
  if (existing) return existing;

  return {
    id: themeId,
    name: themeName,
    description: `${themeName} names screened for financial strength, valuation discipline, and growth outlook.`,
    sentiment: "neutral",
    popularityReason:
      "Generated from InvestSalsa quality filters while live AI / sentiment feeds are offline.",
    stocks: [
      {
        ticker: "SPY",
        name: "Placeholder — configure AI",
        reason: "Enable AI_PROVIDER to generate theme-specific stock lists.",
        metrics: "Add API key to unlock live insights",
        quality: "watch",
        valuationNote: "Fallback only",
      },
    ],
  };
}
