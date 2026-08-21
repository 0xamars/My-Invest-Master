/** Comet stills — long-streak hero for signed-out/OG; quiet textures for empties. */
export const LAUNCH_STILLS = {
  hero: "/stills/hero.jpg",
  heroLockup: "/stills/hero-lockup.jpg",
  freedom: "/stills/freedom.jpg",
  home: "/stills/home.jpg",
  budget: "/stills/budget.jpg",
  invest: "/stills/invest.jpg",
} as const;

export type LaunchStillId = keyof typeof LAUNCH_STILLS;
