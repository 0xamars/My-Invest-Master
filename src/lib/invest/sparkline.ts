export type SparkPointInput = {
  price: number | null;
  change: number | null;
  quantity?: number;
};

/**
 * Two real points: previous close, then last price.
 * Missing price or change stays empty. A zero previous close is not a price.
 */
export function dayMovePoints(
  price: number | null | undefined,
  change: number | null | undefined,
): [number, number] | null {
  if (price == null || change == null) return null;
  if (!Number.isFinite(price) || !Number.isFinite(change)) return null;
  if (price <= 0) return null;
  const previous = price - change;
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return [previous, price];
}

/**
 * Book day move from holdings that already have a price and a change.
 * Quantity weights the line. Rows without a change are skipped.
 */
export function bookDayMovePoints(
  rows: readonly SparkPointInput[],
): [number, number] | null {
  let previous = 0;
  let current = 0;
  let counted = 0;
  for (const row of rows) {
    const points = dayMovePoints(row.price, row.change);
    if (!points) continue;
    const quantity = row.quantity ?? 1;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    previous += points[0] * quantity;
    current += points[1] * quantity;
    counted += 1;
  }
  if (counted === 0 || previous <= 0 || current <= 0) return null;
  return [previous, current];
}
