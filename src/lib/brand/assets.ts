/** Brand JPGs that exist in public/brand. Skip names that are not on disk. */
export const BRAND = {
  logoMark: "/brand/logo-mark.jpg",
  logoLockup: "/brand/logo-lockup.jpg",
  heroMark: "/brand/hero-mark.jpg",
  authPanel: "/brand/auth-panel.jpg",
  emptyBudget: "/brand/empty-budget.jpg",
  emptyInvest: "/brand/empty-invest.jpg",
  emptyFreedom: "/brand/empty-freedom.jpg",
  journeyStations: "/brand/journey-stations.jpg",
} as const;

export const BRAND_SIZE = {
  logoMark: { width: 1408, height: 1408 },
  logoLockup: { width: 1792, height: 1008 },
  heroMark: { width: 1792, height: 1008 },
  authPanel: { width: 1008, height: 1792 },
  emptyBudget: { width: 1152, height: 1712 },
  emptyInvest: { width: 1152, height: 1712 },
  emptyFreedom: { width: 1152, height: 1712 },
  journeyStations: { width: 1792, height: 1008 },
} as const;
