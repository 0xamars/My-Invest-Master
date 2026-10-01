"use client";

import { BudgetBankLink } from "@/components/budget/budget-bank-link";

/**
 * Mounts bank linking so the status request can apply the account flag.
 * Connect stays hidden until that flag is on. An existing link can still be disconnected.
 */
export function BudgetBankLinkGate({
  primary = false,
}: {
  primary?: boolean;
}) {
  return <BudgetBankLink primary={primary} />;
}
