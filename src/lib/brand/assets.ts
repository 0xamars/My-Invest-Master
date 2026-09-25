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
  "See your leftover cash, follow what you own, and know when you can stop working. Budget, Invest, and Retire in one place. Educational, not advice.";

/** Social image alt. Headline plus the Budget, Invest, and Retire line. */
export const OG_IMAGE_ALT =
  "InvestSalsa. Budget, Invest, and Retire: leftover cash, the holdings you own, and when you can stop working.";
