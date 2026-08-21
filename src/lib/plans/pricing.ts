/** Shared plan copy tables. Caps are not shown or enforced. */

export const PRICING_PATH = "/pricing";

export const PRICING_DISCLAIMER =
  "InvestSalsa is for personal finance tracking and education. Nothing on this site is financial, investment, tax, or legal advice.";

export const FREE_PLAN_FEATURES = [
  "1 budget plan",
  "1 portfolio",
  "1 Freedom plan",
  "Manual budget tracking / CSV only",
] as const;

export const PREMIUM_PLAN_FEATURES = [
  "Unlimited budget plans",
  "Unlimited portfolios",
  "Unlimited Freedom plans",
  "Create a Freedom plan from your portfolio",
] as const;

export const PREMIUM_SUPPORT_EMAIL = "admin@investsalsa.com";
