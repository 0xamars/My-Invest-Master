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
  "Couples Retire planner for Canadians. Plan how the two of you draw down RRSP, RRIF, TFSA, and non-registered accounts, and compare withdrawal orders with federal and Ontario tax and OAS clawback, year by year. Educational, not advice.";

/** Social image alt. The picture is the fictional Sam & Riley comparison. */
export const OG_IMAGE_ALT =
  "Example Retire plan for Sam and Riley comparing withdrawal orders. Fictional numbers, amounts in CAD.";
