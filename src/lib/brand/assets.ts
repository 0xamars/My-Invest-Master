/** Public mark and social image. Raster lockups are generated from these. */
export const BRAND = {
  logoMark: "/brand/logo-mark.svg",
  favicon: "/favicon.svg",
  appIcon: "/brand/app-icon.png",
  ogImage: "/og.png",
} as const;

export const BRAND_SIZE = {
  ogImage: { width: 1200, height: 630 },
} as const;

export const SITE_TITLE = "InvestSalsa: Budget, Invest, Retire";

export const SITE_DESCRIPTION =
  "See when you can retire, and which accounts to draw from first, for one person or a couple. Built around RRSP, RRIF, TFSA and non-registered accounts. Educational, not advice.";

/** Social image alt. Does not repeat the homepage headline. */
export const OG_IMAGE_ALT =
  "InvestSalsa Retire planner for one person or a couple. An example compares lifetime tax across four withdrawal orders. Made-up numbers, amounts in CAD.";
