import { isTransferTransaction } from "@/lib/budget/transactions";
import type { BudgetTransaction } from "@/types/budget";

export interface DerivedPayee {
  name: string;
  lastCategoryId: string | null;
  lastDate: string;
}

function payeeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Unique payees derived from the plan JSON. Transfer payees are omitted. */
export function derivePayees(transactions: BudgetTransaction[]): DerivedPayee[] {
  const latest = new Map<string, DerivedPayee>();

  const ordered = [...transactions].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.id.localeCompare(b.id);
  });

  for (const tx of ordered) {
    if (isTransferTransaction(tx)) continue;
    const name = tx.payee.trim();
    if (!name) continue;

    const lastCategoryId =
      tx.splits && tx.splits.length > 0
        ? (tx.splits[0]?.categoryId ?? null)
        : (tx.categoryId ?? null);

    latest.set(payeeKey(name), {
      name,
      lastCategoryId,
      lastDate: tx.date,
    });
  }

  return [...latest.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function findPayee(
  payees: DerivedPayee[],
  name: string,
): DerivedPayee | undefined {
  const key = payeeKey(name);
  if (!key) return undefined;
  return payees.find((payee) => payeeKey(payee.name) === key);
}

export function suggestPayees(
  payees: DerivedPayee[],
  query: string,
  limit = 8,
): DerivedPayee[] {
  const needle = payeeKey(query);
  if (!needle) return payees.slice(0, limit);
  return payees
    .filter((payee) => payeeKey(payee.name).includes(needle))
    .slice(0, limit);
}
