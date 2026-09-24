import { RRSP_CONVERSION_AGE } from "@/types/retirement";

/**
 * Prescribed RRIF minimum factors, federal schedule in force since 2015
 * (Income Tax Regulations, s. 7308).
 *
 * Before age 71 the factor is 1 / (90 − age). From 95 on it is 20%.
 * Ages 71–94 use the published percents, stored here in basis points so
 * 5.28% is exactly 528 / 10_000.
 */
const RRIF_FACTOR_BPS: Record<number, number> = {
  71: 528,
  72: 540,
  73: 553,
  74: 567,
  75: 582,
  76: 598,
  77: 617,
  78: 636,
  79: 658,
  80: 682,
  81: 708,
  82: 738,
  83: 771,
  84: 808,
  85: 851,
  86: 899,
  87: 955,
  88: 1021,
  89: 1099,
  90: 1192,
  91: 1306,
  92: 1449,
  93: 1634,
  94: 1879,
};

/** Factor for the age attained during the year. Fractional ages round down. */
export function prescribedRrifFactor(age: number): number {
  const attained = Math.floor(age);
  if (!Number.isFinite(attained)) return 0;
  if (attained >= 95) return 0.2;
  if (attained >= RRSP_CONVERSION_AGE) {
    return (RRIF_FACTOR_BPS[attained] ?? 2000) / 10_000;
  }
  const denominator = 90 - attained;
  if (denominator <= 0) return 0.2;
  return 1 / denominator;
}

/**
 * `age` is the age at the start of the year, the age CRA uses. Callers that
 * store the age attained during the year pass that age minus one.
 */
export function rrifMinimumAmount(openingValue: number, age: number): number {
  if (openingValue <= 0) return 0;
  return openingValue * prescribedRrifFactor(age);
}

/**
 * An RRSP is still an RRSP during the year the owner turns 71. It is a RRIF
 * after that year ends, or immediately when the projection starts later.
 */
export function rrspConvertsAtYearEnd(age: number, alreadyConverted: boolean): boolean {
  if (alreadyConverted) return false;
  return Math.floor(age) === RRSP_CONVERSION_AGE;
}

export function rrspAlreadyDue(age: number, alreadyConverted: boolean): boolean {
  if (alreadyConverted) return false;
  return Math.floor(age) > RRSP_CONVERSION_AGE;
}
