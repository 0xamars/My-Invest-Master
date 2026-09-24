/**
 * Assumptions for the couples Retire engine. Shown on the plan editor and
 * listed in the pull request. Educational, not advice.
 */
export const RETIRE_ENGINE_ASSUMPTIONS: readonly string[] = [
  "Educational illustration only. Not financial, tax, or retirement advice.",
  "Ages are the age attained during the calendar year. Birthdays are not stored.",
  "An RRSP converts to a RRIF at the end of the year the owner turns 71. Prescribed minimum withdrawals start the next year, the year the owner turns 72.",
  "The minimum uses the owner's age at the start of the year, which is one less than the age attained that year because birthdays are not stored. It is that factor times the account value at the start of the year, before growth. Before 71 the factor is 1/(90−age). Ages 71–94 use the federal percents published since 2015. From 95 on the factor is 20%. The first minimum, in the year the owner turns 72, uses the age-71 factor (5.28%).",
  "If the plan starts after the owner has already turned 71, that RRSP is treated as a RRIF from the first year.",
  "A younger spouse's age does not reduce a minimum unless the survivor view has already transferred that account.",
  "RRIF minimums are withdrawn from that account and count toward the spending gap. Any minimum above the gap is reinvested into non-registered or cash accounts, or into a TFSA if that is the only account that can receive it. If neither exists, the surplus leaves the plan and is shown on its own.",
  "Withdrawals above the RRIF minimum are taken pro-rata from every account that still has a balance. This is not a tax calculation and not a withdrawal order. A later engine can replace this step.",
  "Tax is not calculated. Each year calls a tax hook that currently returns zero.",
  "Household lifestyle spending starts the first year either person reaches their own target age. It is one household number: it is not reduced at death and it is not split into two budgets.",
  "Savings stop when that person reaches their target age. The plan-level savings amount is spread across your accounts until your target age. An account's own annual contribution is added to that account until its owner reaches their target age. Contributions are not inflated.",
  "CPP, OAS, pension, and other income are only the amounts you enter. A stream pays once that person has reached both their target age and the stream's start age. CPP and OAS stop at death. A pension or other stream continues only at the survivor percent you set, which defaults to zero.",
  "Pension income split assigns up to 50% of pension streams to the other person while both are alive. CPP and OAS are not split. The household total does not change. Tax on the split is not calculated, and RRIF withdrawals are not split in this version.",
  "With a spouse, the projection runs until the later plan-end age. Monte Carlo uses that same household path: 750 draws, normal returns, and the existing fixed volatility by asset type.",
  "In the survivor view, death takes effect at the start of the year that person reaches the age you enter, and that age has to be after their current age. Their accounts transfer to the survivor before growth in every year they are already dead. Later RRIF minimums use the survivor's age at the start of the year. The view does not model a CPP survivor pension, the OAS allowance for the survivor, or a smaller household budget.",
  "Existing assets without an account type migrate to non-registered, or to cash when the holding is already cash. The owner defaults to you. Balances, quantities, and growth rates stay. No income and no retire date are added.",
  "Turning the spouse off keeps their accounts and income. Until a spouse is added again, those rows are modeled as yours so the dollars are not dropped.",
];

export const RETIRE_DISCLAIMER =
  "Educational illustration only. Not financial, tax, or retirement advice. This Retire view does not calculate income tax or choose a withdrawal order between RRSP, TFSA, and non-registered accounts.";
