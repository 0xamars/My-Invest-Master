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

/** Nest egg the plan must hold at the target age, in future dollars. */
export function nominalTargetNestEgg(
  annualSpending: number,
  withdrawalRate: number,
  inflationRatePercent: number,
  yearsToRetirement: number,
): number {
  const today = computeTargetNestEgg(annualSpending, withdrawalRate);
  if (today <= 0) return 0;
  if (!Number.isFinite(yearsToRetirement) || yearsToRetirement <= 0) return today;
  const inflation = inflationRatePercent / 100;
  if (!Number.isFinite(inflation) || inflation <= -1) return today;
  return today * (1 + inflation) ** yearsToRetirement;
}
