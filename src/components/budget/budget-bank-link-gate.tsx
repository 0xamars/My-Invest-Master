"use client";

import { BudgetBankLink } from "@/components/budget/budget-bank-link";
import { useFeatureFlag } from "@/hooks/use-feature-flag";

/** Bank linking stays hidden until the flag is on for this account. */
export function BudgetBankLinkGate({
  primary = false,
}: {
  primary?: boolean;
}) {
  const enabled = useFeatureFlag("bank_connect");
  if (enabled !== true) return null;
  return <BudgetBankLink primary={primary} />;
}
