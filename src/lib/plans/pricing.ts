/** Shared Free vs Premium pricing copy for Pricing page and Settings. */

export const PRICING_PATH = "/pricing";

export const PRICING_DISCLAIMER =
  "InvestSalsa is for personal finance tracking and education. Nothing on this site is financial, investment, tax, or legal advice. Billing for Premium is not live yet — early access may be available on request.";

export const FREE_PLAN_FEATURES = [
  "1 portfolio",
  "1 retirement plan",
  "1 budget plan",
  "Manual budget tracking / CSV only",
  "Basic AI help",
  "Limited market insights",
] as const;

export const PREMIUM_PLAN_FEATURES = [
  "Unlimited portfolios",
  "Unlimited retirement plans",
  "Unlimited budget plans",
  "Create retirement plan from an existing portfolio",
  "Full AI assistant",
  "Full market insights",
  "Future: Plaid bank integration",
  "Future: Portfolio intelligence / risk insights",
] as const;

export const PREMIUM_SUPPORT_EMAIL = "admin@investsalsa.com";
