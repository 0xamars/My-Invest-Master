/**
 * Signed-in Imagine art that is not an empty state.
 * Drop a PNG in public/images/imagine/ and set the matching slot.
 * Null slots render nothing — heroes keep the number in front.
 *
 * Expected files:
 *   hero-budget.png, hero-invest.png, hero-retire.png,
 *   hero-home.png, first-run.png, accent.png
 */
export type ImagineSlotId =
  | "hero-budget"
  | "hero-invest"
  | "hero-retire"
  | "hero-home"
  | "first-run"
  | "accent";

export type ImagineFile = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export const IMAGINE_SLOTS: Record<ImagineSlotId, ImagineFile | null> = {
  "hero-budget": null,
  "hero-invest": null,
  "hero-retire": null,
  "hero-home": null,
  "first-run": null,
  accent: null,
};
