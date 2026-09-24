export function inflateFromToday(
  amountToday: number,
  inflationRatePercent: number,
  yearsFromNow: number,
): number {
  if (amountToday <= 0) return 0;
  if (yearsFromNow <= 0) return amountToday;
  return amountToday * (1 + inflationRatePercent / 100) ** yearsFromNow;
}
