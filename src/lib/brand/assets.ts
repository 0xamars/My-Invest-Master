/** Brand JPGs that exist in public/brand. Skip names that are not on disk. */
export const BRAND = {
  logoMark: "/brand/logo-mark.jpg",
  logoLockup: "/brand/logo-lockup.jpg",
  authPanel: "/brand/auth-panel.jpg",
} as const;

export const BRAND_SIZE = {
  logoMark: { width: 1408, height: 1408 },
  logoLockup: { width: 1792, height: 1008 },
  authPanel: { width: 1008, height: 1792 },
} as const;
