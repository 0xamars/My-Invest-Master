/**
 * Imagine empty PNGs. The field is flat #141518, the same as the card,
 * so a centered stack has no separate artboard edge.
 */
export const EMPTY_ART = {
  budget: {
    src: "/brand/empties/empty-budget.png",
    alt: "Illustration of stacked envelopes",
    width: 1408,
    height: 1408,
  },
  invest: {
    src: "/brand/empties/empty-invest.png",
    alt: "Illustration of a rising chart",
    width: 1408,
    height: 1408,
  },
  retire: {
    src: "/brand/empties/empty-retire.png",
    alt: "Illustration of a path to a horizon",
    width: 1408,
    height: 1408,
  },
  home: {
    src: "/brand/empties/empty-home.png",
    alt: "Illustration of Budget, Invest, and Retire tiles",
    width: 1408,
    height: 1408,
  },
  transactions: {
    src: "/brand/empties/empty-transactions.png",
    alt: "Illustration of an empty list with an add mark",
    width: 1408,
    height: 1408,
  },
} as const;

export type EmptyArtKind = keyof typeof EMPTY_ART;

export function emptyArtText(): string {
  return JSON.stringify(EMPTY_ART);
}
