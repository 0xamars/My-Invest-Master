import { DEFAULT_WITHDRAWAL_RATE } from "@/types/retirement";

export function computeTargetNestEgg(
  annualSpending: number,
  withdrawalRate: number = DEFAULT_WITHDRAWAL_RATE,
): number {
  const rate = withdrawalRate / 100;
  if (!Number.isFinite(annualSpending) || annualSpending <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return annualSpending / rate;
}

export function presentValue(
  futureValue: number,
  inflationRatePercent: number,
  years: number,
): number {
  if (!Number.isFinite(futureValue)) return 0;
  if (!Number.isFinite(years) || years <= 0) return futureValue;
  const inflation = inflationRatePercent / 100;
  if (!Number.isFinite(inflation) || inflation <= -1) return futureValue;
  return futureValue / (1 + inflation) ** years;
}
