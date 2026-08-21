/** Launch stills — originals only. Never the Dogan Ural sampling photo. */
export const LAUNCH_STILLS = {
  hero: "/stills/hero.jpg",
  freedom: "/stills/freedom.jpg",
  home: "/stills/home.jpg",
  budget: "/stills/budget.jpg",
  invest: "/stills/invest.jpg",
} as const;

export type LaunchStillId = keyof typeof LAUNCH_STILLS;
