const SECTOR_RULES: { match: RegExp; sector: string }[] = [
  {
    match: /pharma|biotech|health|medical|diagnostic|surgical|therapeutic|science|amgen|gilead|dexcom|regeneron|vertex/i,
    sector: "Healthcare",
  },
  {
    match: /retail|restaurant|commerce|motor|automotive|booking|travel|starbucks|pepsi|costco|walmart|ross|marriott|airbnb|door/i,
    sector: "Consumer Cyclical",
  },
  {
    match: /telecom|mobile|communication|media|netflix|entertainment|comcast|warner|electronic arts|take-two/i,
    sector: "Communication Services",
  },
  { match: /energy|oil|gas|linde|diamondback|exelon|xcel|constellation/i, sector: "Energy" },
  { match: /financial|payment|paypal|intuit|paychex|ferrovial/i, sector: "Financial" },
  { match: /industrial|aerospace|defense|honeywell|fastenal|cintas|paccar|old dominion|copart|axon|teradyne|rocket/i,
    sector: "Industrials" },
  { match: /real estate|reit|equity residential/i, sector: "Real Estate" },
  { match: /utility|utilities|american electric/i, sector: "Utilities" },
  { match: /materials|mining|gold|steel|chem/i, sector: "Basic Materials" },
  { match: /consumer|staple|kraft|keurig|mondelez|monster|kroger|colgate|procter|clorox/i, sector: "Consumer Defensive" },
];

export function inferIndexSector(name: string): string {
  for (const rule of SECTOR_RULES) {
    if (rule.match.test(name)) return rule.sector;
  }
  return "Technology";
}
