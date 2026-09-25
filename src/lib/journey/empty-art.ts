/** Grok Imagine empty art. Sources were JPEG; shipped compressed. */
export const EMPTY_ART = {
  budget: {
    src: "/brand/empties/empty-budget.jpg",
    alt: "Illustration of stacked envelopes",
    width: 960,
    height: 540,
  },
  invest: {
    src: "/brand/empties/empty-invest.jpg",
    alt: "Illustration of a rising chart",
    width: 960,
    height: 540,
  },
  retire: {
    src: "/brand/empties/empty-retire.jpg",
    alt: "Illustration of a path to a horizon",
    width: 960,
    height: 540,
  },
  home: {
    src: "/brand/empties/empty-home.jpg",
    alt: "Illustration of Budget, Invest, and Retire tiles",
    width: 960,
    height: 540,
  },
  transactions: {
    src: "/brand/empties/empty-transactions.jpg",
    alt: "Illustration of an empty list with an add mark",
    width: 960,
    height: 540,
  },
} as const;

export type EmptyArtKind = keyof typeof EMPTY_ART;

export function emptyArtText(): string {
  return JSON.stringify(EMPTY_ART);
}
