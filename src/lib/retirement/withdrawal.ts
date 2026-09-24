import type {
  ProjectedAccountKind,
  RetirementPersonId,
} from "@/types/retirement";

/**
 * One year of withdrawals. Tax-aware orders in `withdrawal-orders.ts` replace
 * `applyProRataWithdrawal` without rewriting growth, contributions, or RRIF
 * minimums. Optional `people` and `year` are ignored by the pro-rata engine.
 */
export interface WithdrawalAccountInput {
  id: string;
  owner: RetirementPersonId;
  kind: ProjectedAccountKind;
  /** Value after this year's growth and before contributions. */
  value: number;
  contribution: number;
  /** Dollar minimum calculated from the start-of-year value. */
  rrifMinimum: number;
}

export interface WithdrawalPersonInput {
  id: RetirementPersonId;
  age: number;
  retired: boolean;
  deceased: boolean;
  cpp: number;
  oas: number;
  pension: number;
  pensionAfterSplit: number;
  other: number;
}

export interface WithdrawalYearInput {
  /**
   * Lifestyle spending plus tax, minus non-portfolio income. Zero during
   * the working years. Not reduced by the RRIF minimum; the engine does that.
   */
  spendingGap: number;
  accounts: WithdrawalAccountInput[];
  /** Calendar year. Ordered engines record their last result for this year. */
  year?: number;
  /**
   * Non-portfolio income for the year. Ordered engines use it to choose which
   * spouse to draw from. The pro-rata engine ignores it.
   */
  people?: WithdrawalPersonInput[];
}

export interface WithdrawalYearResult {
  closingByAccount: Record<string, number>;
  withdrawalByAccount: Record<string, number>;
  contributionTotal: number;
  /** Amount the household asked the portfolio to fund. May exceed the balance. */
  portfolioWithdrawal: number;
  rrifMinimum: number;
  rrifSurplusReinvested: number;
  rrifSurplusLeftPlan: number;
}

export type WithdrawalEngine = (input: WithdrawalYearInput) => WithdrawalYearResult;

function sumIds(values: Record<string, number>, ids: string[]): number {
  return ids.reduce((sum, id) => sum + Math.max(0, values[id] ?? 0), 0);
}

function addProRata(
  values: Record<string, number>,
  amount: number,
  ids: string[],
): void {
  if (amount <= 0 || ids.length === 0) return;
  const total = sumIds(values, ids);
  if (total > 0) {
    for (const id of ids) {
      const value = Math.max(0, values[id] ?? 0);
      values[id] = (values[id] ?? 0) + amount * (value / total);
    }
    return;
  }
  const share = amount / ids.length;
  for (const id of ids) {
    values[id] = (values[id] ?? 0) + share;
  }
}

function withdrawProRata(
  values: Record<string, number>,
  amount: number,
  ids: string[],
  taken: Record<string, number>,
): number {
  const total = sumIds(values, ids);
  const withdrawal = Math.min(Math.max(0, amount), Math.max(0, total));
  if (total <= 0 || withdrawal <= 0) return 0;
  const ratio = (total - withdrawal) / total;
  for (const id of ids) {
    const before = Math.max(0, values[id] ?? 0);
    const after = before * ratio;
    values[id] = after;
    taken[id] = (taken[id] ?? 0) + (before - after);
  }
  return withdrawal;
}

/**
 * Default engine, deliberately not an account order:
 * 1. Add each account's contribution.
 * 2. Withdraw each RRIF minimum from that RRIF, capped by its balance.
 * 3. Withdraw any remaining spending gap pro-rata from every account.
 * 4. Reinvest RRIF cash above the gap into non-registered or cash, then
 *    TFSA if that is the only available account. Otherwise it leaves the plan.
 */
export function applyProRataWithdrawal(
  input: WithdrawalYearInput,
): WithdrawalYearResult {
  const values: Record<string, number> = {};
  const taken: Record<string, number> = {};
  let contributionTotal = 0;

  for (const account of input.accounts) {
    const contribution = Math.max(0, account.contribution);
    values[account.id] = Math.max(0, account.value) + contribution;
    contributionTotal += contribution;
    taken[account.id] = 0;
  }

  let rrifMinimum = 0;
  for (const account of input.accounts) {
    if (account.kind !== "rrif") continue;
    const minimum = Math.max(0, account.rrifMinimum);
    const available = Math.max(0, values[account.id] ?? 0);
    const draw = Math.min(minimum, available);
    values[account.id] = available - draw;
    taken[account.id] = (taken[account.id] ?? 0) + draw;
    rrifMinimum += draw;
  }

  const gap = Math.max(0, input.spendingGap);
  const fundedByMinimum = Math.min(rrifMinimum, gap);
  const remainingGap = gap - fundedByMinimum;
  const ids = input.accounts.map((account) => account.id);
  withdrawProRata(values, remainingGap, ids, taken);

  let surplus = Math.max(0, rrifMinimum - gap);
  const nonRegisteredOrCash = input.accounts
    .filter((account) => account.kind === "non_registered" || account.kind === "cash")
    .map((account) => account.id);
  const tfsa = input.accounts
    .filter((account) => account.kind === "tfsa")
    .map((account) => account.id);
  const destination =
    nonRegisteredOrCash.length > 0
      ? nonRegisteredOrCash
      : tfsa.length > 0
        ? tfsa
        : [];

  let rrifSurplusReinvested = 0;
  let rrifSurplusLeftPlan = surplus;
  if (surplus > 0 && destination.length > 0) {
    addProRata(values, surplus, destination);
    rrifSurplusReinvested = surplus;
    rrifSurplusLeftPlan = 0;
    surplus = 0;
  }

  const closingByAccount: Record<string, number> = {};
  for (const account of input.accounts) {
    closingByAccount[account.id] = Math.max(0, values[account.id] ?? 0);
  }

  return {
    closingByAccount,
    withdrawalByAccount: taken,
    contributionTotal,
    portfolioWithdrawal: gap,
    rrifMinimum,
    rrifSurplusReinvested,
    rrifSurplusLeftPlan,
  };
}
