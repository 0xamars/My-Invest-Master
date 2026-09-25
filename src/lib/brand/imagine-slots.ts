/**
 * Signed-in Imagine art that is not an empty state.
 * Files live in public/images/imagine/. Empty states stay in public/brand/empties/.
 */
export type ImagineSlotId =
  | "hero-budget"
  | "hero-invest"
  | "hero-retire"
  | "first-run-welcome"
  | "accent-checklist"
  | "accent-spark";

export type ImagineFile = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

const square = { width: 1408, height: 1408 };

export const IMAGINE_SLOTS: Record<ImagineSlotId, ImagineFile> = {
  "hero-budget": {
    src: "/images/imagine/hero-budget.png",
    alt: "Soft green orb on a pedestal",
    ...square,
  },
  "hero-invest": {
    src: "/images/imagine/hero-invest.png",
    alt: "Ascending green ribbon with an orange tip",
    ...square,
  },
  "hero-retire": {
    src: "/images/imagine/hero-retire.png",
    alt: "A path toward a green horizon",
    ...square,
  },
  "first-run-welcome": {
    src: "/images/imagine/first-run-welcome.png",
    alt: "Three tiles joined by a green path",
    ...square,
  },
  "accent-checklist": {
    src: "/images/imagine/accent-checklist.png",
    alt: "Checklist with a green progress mark",
    ...square,
  },
  "accent-spark": {
    src: "/images/imagine/accent-spark.png",
    alt: "Small green spark badge",
    ...square,
  },
};
