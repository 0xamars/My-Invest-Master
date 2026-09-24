import type {
  ProjectedAccountKind,
  RetirementPersonId,
} from "@/types/retirement";

/**
 * Input for a later year-by-year tax pass. The projection calls this hook
 * and adds `taxPayable` to the spending gap. The default returns 0, so
 * today's totals do not include tax, OAS clawback, or a withdrawal order.
 *
 * TODO: When this hook starts calculating tax, eligible pension income under
 * 65 is limited to registered pension life annuities, and RRIF income becomes
 * splittable at 65. The split recorded today does not apply those limits and
 * does not change any projected number.
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
