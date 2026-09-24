import type {
  ProjectedAccountKind,
  RetirementPersonId,
} from "@/types/retirement";

/**
 * Input for a year-by-year tax pass. The projection calls this hook and adds
 * `taxPayable` to the spending gap. The default returns 0, so the chart and
 * the balance table do not include tax.
 *
 * `withdrawal` on each account is set by the fixed-point loop in the projection
 * once a tax engine is supplied. Omit it, or leave it at 0, when the withdrawal
 * for the year is not known yet.
 *
 * Eligible pension under 65 is only a registered pension. This model treats
 * every pension stream as that, because the plan cannot tell a life annuity
 * from other pension income. RRIF income is split in the Canadian tax engine
 * when both people are alive and the owner is 65 or older, using
 * `pensionSplitPercent`. RRSP withdrawals are not split. The household income
 * split still runs before this hook and still does not itself calculate tax.
 */
export interface RetirementTaxPerson {
  id: RetirementPersonId;
  age: number;
  retired: boolean;
  deceased: boolean;
  cpp: number;
  oas: number;
  pension: number;
  /** Pension after the 0–50 split. Equal to `pension` when the split is 0. */
  pensionAfterSplit: number;
  other: number;
}

export interface RetirementTaxAccount {
  id: string;
  owner: RetirementPersonId;
  kind: ProjectedAccountKind;
  openingValue: number;
  rrifMinimum: number;
  contribution: number;
  /**
   * Dollars withdrawn this year, in stored plan dollars. Optional so existing
   * callers stay valid. Treated as 0 when omitted.
   */
  withdrawal?: number;
}

/** Per-person tax detail. Dollar fields use the same stored units as the plan. */
export interface RetirementTaxPersonDetail {
  id: RetirementPersonId;
  age: number;
  /** Net income before the OAS recovery deduction. */
  netIncomeBeforeClawback: number;
  taxableIncome: number;
  federalTax: number;
  provincialTax: number;
  oasClawback: number;
  totalTax: number;
  oas: number;
  /** Eligible pension income before the credit cap, including split RRIF income. */
  eligiblePension: number;
}

export interface RetirementTaxYearInput {
  year: number;
  spending: number;
  pensionSplitPercent: number;
  people: RetirementTaxPerson[];
  accounts: RetirementTaxAccount[];
}

export interface RetirementTaxYearResult {
  taxPayable: number;
  /** Present when the engine can attribute tax. The projection reads `taxPayable` only. */
  people?: RetirementTaxPersonDetail[];
}

export type RetirementTaxEngine = (
  input: RetirementTaxYearInput,
) => RetirementTaxYearResult;

export const noTaxEngine: RetirementTaxEngine = () => ({ taxPayable: 0 });

export function taxPayableFrom(
  engine: RetirementTaxEngine | undefined,
  input: RetirementTaxYearInput,
): number {
  const raw = engine ? engine(input).taxPayable : 0;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw;
}
